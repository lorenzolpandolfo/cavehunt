import { Room, ServerError, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { z } from 'zod';
import { NICKNAME_PATTERN, PROTOCOL_VERSION, type InitialWorld, type ChunkWindow } from '../../../shared/src/protocol.ts';
import { SIMULATION_STEP_MS, INPUT_TIMEOUT_MS, idleMovement, type MovementCommand, type Direction } from '../../../shared/src/movement.ts';
import { chunkKey, pixelToChunk } from '../../../shared/src/coordinates.ts';
import { type WorldStore } from '../storage/WorldStore.ts';
import { movePlayer, objectRectangle, type Rectangle } from '../player/movement.ts';

const PlayerState = schema({
    id: t.string(), nickname: t.string(), x: t.number(), y: t.number(),
    direction: t.string().default('down'), moving: t.boolean().default(false)
}, 'Player');
const WorldState = schema({ players: t.map(PlayerState) }, 'World');
const joinOptions = z.object({ nickname: z.string().trim().regex(NICKNAME_PATTERN), protocolVersion: z.literal(PROTOCOL_VERSION) });
const movementCommand = z.object({
    left: z.boolean(), right: z.boolean(), up: z.boolean(), down: z.boolean(), boost: z.boolean(),
    sequence: z.number().int().nonnegative().safe()
}).strict();
const AUTOSAVE_MS = 2000;
const MAX_CATCHUP_MS = 250;

export function createWorldRoom(store: WorldStore, maxPlayers: number)
{
    let created = false;
    return class WorldRoom extends Room<{ state: InstanceType<typeof WorldState> }>
    {
        state = new WorldState();
        private readonly reserved = new Set<string>();
        private readonly sessions = new Map<string, string>();
        private readonly windows = new Map<string, string>();
        private readonly movementInputs = new Map<string, { command: MovementCommand; receivedAt: number }>();
        private readonly loading = new Set<string>();
        private readonly obstacles = new Map<string, Rectangle[]>();
        private elapsed = 0;
        private suspended = false;
        private saving = false;

        onCreate(): void
        {
            if (created) throw new ServerError(409, 'The world already exists. Join the existing room.');
            created = true;
            this.maxClients = maxPlayers;
            this.autoDispose = false;
            this.maxMessagesPerSecond = 40;
            this.setPatchRate(SIMULATION_STEP_MS);
            this.onMessage('world:request', client => {
                const id = this.sessions.get(client.sessionId);
                const player = id ? this.state.players.get(id) : undefined;
                if (!player || this.windows.has(client.sessionId)) return;
                const message: InitialWorld = {
                    metadata: store.metadata, playerId: player.id, chunks: store.chunksFor(player)
                };
                this.windows.set(client.sessionId, this.center(player));
                client.send('world:initial', message);
            });
            this.onMessage('player:input', (client, raw: unknown) => {
                if (this.suspended || !this.windows.has(client.sessionId)) return;
                const parsed = movementCommand.safeParse(raw);
                if (!parsed.success) return;
                const previous = this.movementInputs.get(client.sessionId);
                if (previous && parsed.data.sequence <= previous.command.sequence) return;
                this.movementInputs.set(client.sessionId, { command: parsed.data, receivedAt: performance.now() });
            });
            this.setSimulationInterval(deltaMs => {
                this.elapsed += Math.min(deltaMs, MAX_CATCHUP_MS);
                while (this.elapsed >= SIMULATION_STEP_MS)
                {
                    this.step();
                    this.elapsed -= SIMULATION_STEP_MS;
                }
            }, SIMULATION_STEP_MS);
            this.clock.setInterval(() => {
                if (this.saving) return;
                this.saving = true;
                void store.flush(this.suspended).then(() => { this.suspended = false; })
                    .catch(error => this.storageFailed(error))
                    .finally(() => { this.saving = false; });
            }, AUTOSAVE_MS);
        }

        async onJoin(client: Client, options: unknown): Promise<void>
        {
            if (this.suspended) throw new ServerError(503, 'World storage is unavailable. Please try again.');
            const parsed = joinOptions.safeParse(options);
            if (!parsed.success) throw new ServerError(400, 'Invalid nickname or incompatible protocol version.');
            const nickname = parsed.data.nickname;
            const id = nickname.toLowerCase();
            if (this.reserved.has(id)) throw new ServerError(409, 'This nickname is already connected.');
            this.reserved.add(id);
            this.sessions.set(client.sessionId, id);
            try
            {
                const player = await store.preparePlayer(id, nickname, () => [...this.state.players.values()]);
                this.state.players.set(id, new PlayerState(player));
            }
            catch (error)
            {
                this.sessions.delete(client.sessionId);
                this.reserved.delete(id);
                console.error('World admission failed:', error);
                throw new ServerError(503, 'Could not save the world. Please try again.');
            }
        }

        async onLeave(client: Client): Promise<void>
        {
            const id = this.sessions.get(client.sessionId);
            this.sessions.delete(client.sessionId);
            this.windows.delete(client.sessionId);
            this.movementInputs.delete(client.sessionId);
            this.loading.delete(client.sessionId);
            if (!id) return;
            this.state.players.delete(id);
            try { await store.flush(); }
            catch (error) { this.storageFailed(error); }
            finally { this.reserved.delete(id); }
        }

        private step(): void
        {
            if (this.suspended) return;
            const now = performance.now();
            for (const client of this.clients)
            {
                const id = this.sessions.get(client.sessionId);
                const player = id ? this.state.players.get(id) : undefined;
                if (!player || !this.windows.has(client.sessionId)) continue;
                if (this.loading.has(client.sessionId))
                {
                    player.moving = false;
                    continue;
                }
                const received = this.movementInputs.get(client.sessionId);
                const input = received && now - received.receivedAt <= INPUT_TIMEOUT_MS ? received.command : idleMovement();
                const obstacles = store.chunksFor(player).flatMap(chunk => {
                    const key = chunkKey(chunk.x, chunk.y);
                    let cached = this.obstacles.get(key);
                    if (!cached)
                    {
                        cached = chunk.objects.flatMap(object => {
                            const rectangle = objectRectangle(object);
                            return rectangle ? [rectangle] : [];
                        });
                        this.obstacles.set(key, cached);
                    }
                    return cached;
                });
                const next = movePlayer({ x: player.x, y: player.y, moving: player.moving, direction: player.direction as Direction }, input, SIMULATION_STEP_MS, obstacles);
                if (!store.hasWindow(next))
                {
                    player.moving = false;
                    this.loading.add(client.sessionId);
                    void store.ensureWindow(next).catch(error => this.storageFailed(error))
                        .finally(() => this.loading.delete(client.sessionId));
                    continue;
                }
                store.updatePosition(player.id, next.x, next.y);
                player.x = next.x;
                player.y = next.y;
                player.direction = next.direction;
                player.moving = next.moving;
                const center = this.center(player);
                if (this.windows.get(client.sessionId) !== center)
                {
                    const message: ChunkWindow = { chunks: store.chunksFor(player) };
                    client.send('world:chunks', message);
                    this.windows.set(client.sessionId, center);
                }
            }
        }

        private center(player: { x: number; y: number }): string
        {
            return chunkKey(pixelToChunk(player.x), pixelToChunk(player.y));
        }

        private storageFailed(error: unknown): void
        {
            console.error('World save failed:', error);
            this.suspended = true;
            this.movementInputs.clear();
            for (const player of this.state.players.values()) player.moving = false;
            this.broadcast('world:error', 'World storage is unavailable. Movement has stopped; reconnect to try again.');
        }
    };
}
