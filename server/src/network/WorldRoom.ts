import { Room, ServerError, type Client } from "@colyseus/core";
import { schema, t } from "@colyseus/schema";
import { z } from "zod";
import {
  NICKNAME_PATTERN,
  PROTOCOL_VERSION,
  type InitialWorld,
  type ChunkWindow,
  type PlayerCorrection,
} from "../../../shared/src/protocol.ts";
import {
  SIMULATION_STEP_MS,
  type MovementCommand,
  type Direction,
} from "../../../shared/src/movement.ts";
import { chunkKey, pixelToChunk } from "../../../shared/src/coordinates.ts";
import { type WorldStore } from "../storage/WorldStore.ts";
import {
  movePlayer,
  objectRectangle,
  type Rectangle,
} from "../player/movement.ts";

const PlayerState = schema(
  {
    id: t.string(),
    nickname: t.string(),
    x: t.number(),
    y: t.number(),
    direction: t.string().default("down"),
    moving: t.boolean().default(false),
    lastProcessedSequence: t.number().default(-1),
  },
  "Player",
);
const WorldState = schema({ players: t.map(PlayerState) }, "World");
const joinOptions = z.object({
  nickname: z.string().trim().regex(NICKNAME_PATTERN),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});
const movementCommand = z
  .object({
    left: z.boolean(),
    right: z.boolean(),
    up: z.boolean(),
    down: z.boolean(),
    boost: z.boolean(),
    sequence: z.number().int().nonnegative().safe(),
    epoch: z.number().int().nonnegative().safe(),
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();
const AUTOSAVE_MS = 2000;
const ANIMAL_UPDATE_MS = 100;
const MAX_CATCHUP_MS = 250;
const MAX_PENDING_INPUTS = 20;
const POSITION_TOLERANCE = 0.01;

export function createWorldRoom(store: WorldStore, maxPlayers: number) {
  let created = false;
  return class WorldRoom extends Room<{
    state: InstanceType<typeof WorldState>;
  }> {
    state = new WorldState();
    private readonly reserved = new Set<string>();
    private readonly sessions = new Map<string, string>();
    private readonly windows = new Map<string, string>();
    private readonly movementInputs = new Map<
      string,
      {
        queue: MovementCommand[];
        lastSequence: number;
        epoch: number;
      }
    >();
    private readonly loading = new Set<string>();
    private readonly obstacles = new Map<string, Rectangle[]>();
    private readonly pendingAnimalChunks = new Set<string>();
    private elapsed = 0;
    private animalUpdateElapsed = 0;
    private suspended = false;
    private saving = false;

    onCreate(): void {
      if (created)
        throw new ServerError(
          409,
          "The world already exists. Join the existing room.",
        );
      created = true;
      this.maxClients = maxPlayers;
      this.autoDispose = false;
      this.maxMessagesPerSecond = 40;
      this.setPatchRate(SIMULATION_STEP_MS);
      this.onMessage("world:request", (client) => {
        const id = this.sessions.get(client.sessionId);
        const player = id ? this.state.players.get(id) : undefined;
        if (!player || this.windows.has(client.sessionId)) return;
        const message: InitialWorld = {
          metadata: store.metadata,
          playerId: player.id,
          chunks: store.chunksFor(player),
        };
        this.windows.set(client.sessionId, this.center(player));
        client.send("world:initial", message);
      });
      this.onMessage("player:input", (client, raw: unknown) => {
        if (this.suspended || !this.windows.has(client.sessionId)) return;
        const parsed = movementCommand.safeParse(raw);
        if (!parsed.success) return;
        let pending = this.movementInputs.get(client.sessionId);
        if (!pending) {
          pending = { queue: [], lastSequence: -1, epoch: 0 };
          this.movementInputs.set(client.sessionId, pending);
        }
        if (
          parsed.data.epoch !== pending.epoch ||
          parsed.data.sequence <= pending.lastSequence
        )
          return;
        pending.lastSequence = parsed.data.sequence;
        if (pending.queue.length === MAX_PENDING_INPUTS) {
          const id = this.sessions.get(client.sessionId);
          const player = id ? this.state.players.get(id) : undefined;
          if (player) this.correct(client, player, pending);
          return;
        }
        pending.queue.push(parsed.data);
      });
      this.setSimulationInterval((deltaMs) => {
        this.elapsed += Math.min(deltaMs, MAX_CATCHUP_MS);
        while (this.elapsed >= SIMULATION_STEP_MS) {
          this.step();
          this.elapsed -= SIMULATION_STEP_MS;
        }
      }, SIMULATION_STEP_MS);
      this.clock.setInterval(() => {
        if (this.saving) return;
        this.saving = true;
        void store
          .flush(this.suspended)
          .then(() => {
            this.suspended = false;
          })
          .catch((error) => this.storageFailed(error))
          .finally(() => {
            this.saving = false;
          });
      }, AUTOSAVE_MS);
    }

    async onJoin(client: Client, options: unknown): Promise<void> {
      if (this.suspended)
        throw new ServerError(
          503,
          "World storage is unavailable. Please try again.",
        );
      const parsed = joinOptions.safeParse(options);
      if (!parsed.success)
        throw new ServerError(
          400,
          "Invalid nickname or incompatible protocol version.",
        );
      const nickname = parsed.data.nickname;
      const id = nickname.toLowerCase();
      if (this.reserved.has(id))
        throw new ServerError(409, "This nickname is already connected.");
      this.reserved.add(id);
      this.sessions.set(client.sessionId, id);
      try {
        const player = await store.preparePlayer(id, nickname, () => [
          ...this.state.players.values(),
        ]);
        this.state.players.set(id, new PlayerState(player));
      } catch (error) {
        this.sessions.delete(client.sessionId);
        this.reserved.delete(id);
        console.error("World admission failed:", error);
        throw new ServerError(
          503,
          "Could not save the world. Please try again.",
        );
      }
    }

    async onLeave(client: Client): Promise<void> {
      const id = this.sessions.get(client.sessionId);
      this.sessions.delete(client.sessionId);
      this.windows.delete(client.sessionId);
      this.movementInputs.delete(client.sessionId);
      this.loading.delete(client.sessionId);
      if (!id) return;
      this.state.players.delete(id);
      try {
        await store.flush();
      } catch (error) {
        this.storageFailed(error);
      } finally {
        this.reserved.delete(id);
      }
    }

    private step(): void {
      if (this.suspended) return;
      for (const client of this.clients) {
        const id = this.sessions.get(client.sessionId);
        const player = id ? this.state.players.get(id) : undefined;
        if (!player || !this.windows.has(client.sessionId)) continue;
        if (this.loading.has(client.sessionId)) {
          player.moving = false;
          continue;
        }
        const pending = this.movementInputs.get(client.sessionId);
        const command = pending?.queue[0];
        if (!command) {
          player.moving = false;
          continue;
        }
        const obstacles = store.chunksFor(player).flatMap((chunk) => {
          const key = chunkKey(chunk.x, chunk.y);
          let cached = this.obstacles.get(key);
          if (!cached) {
            cached = chunk.objects.flatMap((object) => {
              const rectangle = objectRectangle(object);
              return rectangle ? [rectangle] : [];
            });
            this.obstacles.set(key, cached);
          }
          return cached;
        });
        const next = movePlayer(
          {
            x: player.x,
            y: player.y,
            moving: player.moving,
            direction: player.direction as Direction,
          },
          command,
          SIMULATION_STEP_MS,
          obstacles,
        );
        if (!store.hasWindow(next)) {
          player.moving = false;
          this.loading.add(client.sessionId);
          void store
            .ensureWindow(next)
            .catch((error) => this.storageFailed(error))
            .finally(() => this.loading.delete(client.sessionId));
          continue;
        }
        pending.queue.shift();
        if (
          Math.abs(command.x - next.x) > POSITION_TOLERANCE ||
          Math.abs(command.y - next.y) > POSITION_TOLERANCE
        ) {
          this.correct(client, player, pending);
          continue;
        }
        player.lastProcessedSequence = command.sequence;
        store.updatePosition(player.id, next.x, next.y);
        player.x = next.x;
        player.y = next.y;
        player.direction = next.direction;
        player.moving = next.moving;
        const center = this.center(player);
        if (this.windows.get(client.sessionId) !== center) {
          const message: ChunkWindow = { chunks: store.chunksFor(player) };
          client.send("world:chunks", message);
          this.windows.set(client.sessionId, center);
        }
      }
      this.advanceAnimals();
    }

    private advanceAnimals(): void {
      const active = new Set<string>();
      for (const client of this.clients) {
        const id = this.sessions.get(client.sessionId);
        const player = id ? this.state.players.get(id) : undefined;
        if (!player || !this.windows.has(client.sessionId)) continue;
        for (const chunk of store.chunksFor(player))
          active.add(chunkKey(chunk.x, chunk.y));
      }
      for (const key of store.advanceAnimals(active, SIMULATION_STEP_MS))
        this.pendingAnimalChunks.add(key);
      this.animalUpdateElapsed += SIMULATION_STEP_MS;
      if (this.animalUpdateElapsed < ANIMAL_UPDATE_MS) return;
      this.animalUpdateElapsed = 0;
      if (this.pendingAnimalChunks.size === 0) return;

      const updates = new Map(
        [...this.pendingAnimalChunks].flatMap((key) => {
          const update = store.animalUpdate(key);
          return update ? [[key, update] as const] : [];
        }),
      );
      for (const client of this.clients) {
        const id = this.sessions.get(client.sessionId);
        const player = id ? this.state.players.get(id) : undefined;
        if (!player || !this.windows.has(client.sessionId)) continue;
        for (const chunk of store.chunksFor(player)) {
          const update = updates.get(chunkKey(chunk.x, chunk.y));
          if (update) client.send("world:animals", update);
        }
      }
      this.pendingAnimalChunks.clear();
    }

    private center(player: { x: number; y: number }): string {
      return chunkKey(pixelToChunk(player.x), pixelToChunk(player.y));
    }

    private correct(
      client: Client,
      player: InstanceType<typeof PlayerState>,
      pending: {
        queue: MovementCommand[];
        lastSequence: number;
        epoch: number;
      },
    ): void {
      pending.queue.length = 0;
      pending.epoch++;
      player.moving = false;
      const correction: PlayerCorrection = {
        x: player.x,
        y: player.y,
        direction: player.direction as Direction,
        moving: false,
        epoch: pending.epoch,
      };
      client.send("player:correction", correction);
    }

    private storageFailed(error: unknown): void {
      console.error("World save failed:", error);
      this.suspended = true;
      this.movementInputs.clear();
      for (const player of this.state.players.values()) player.moving = false;
      this.broadcast(
        "world:error",
        "World storage is unavailable. Movement has stopped; reconnect to try again.",
      );
    }
  };
}
