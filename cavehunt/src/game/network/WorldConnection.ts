import { type MovementCommand } from '../../../../shared/src/movement.ts';
import { Client, type Room } from '@colyseus/sdk';
import { ROOM_NAME, PROTOCOL_VERSION, type InitialWorld, type PlayerSnapshot, type ChunkWindow, type AnimalUpdate, type PlayerCorrection } from '../../../../shared/src/protocol.ts';

interface NetworkState {
    players: Map<string, PlayerSnapshot>;
}

type NetworkRoom = Room<unknown, NetworkState>;

export interface WorldConnectionEvents {
    world: (world: InitialWorld) => void;
    chunks: (window: ChunkWindow) => void;
    animals: (update: AnimalUpdate) => void;
    players: (players: readonly PlayerSnapshot[]) => void;
    correction: (correction: PlayerCorrection) => void;
    disconnected: (message: string) => void;
}

export class WorldConnection
{
    private room?: NetworkRoom;
    private closed = false;
    private timeout?: ReturnType<typeof setTimeout>;
    private readonly dispose: (() => void)[] = [];
    private initialReceived = false;
    private readonly endpoint: string;
    private readonly events: WorldConnectionEvents;

    constructor(endpoint: string, events: WorldConnectionEvents)
    {
        this.endpoint = endpoint;
        this.events = events;
    }

    async connect(nickname: string): Promise<void>
    {
        this.timeout = setTimeout(() => this.fail('Connection timed out. Please try again.'), 20000);
        try
        {
            const room = await new Client(this.endpoint).join<NetworkState>(ROOM_NAME, { nickname, protocolVersion: PROTOCOL_VERSION });
            room.reconnection.enabled = false;
            if (this.closed)
            {
                await room.leave();
                return;
            }
            this.room = room;
            const onState = (state: NetworkState) => {
                if (this.initialReceived) this.events.players([...state.players.values()]);
            };
            const onLeave = () => this.fail('Connection lost. Enter your nickname to reconnect.');
            const onError = (_code: number, message?: string) => this.fail(message ?? 'Connection failed.');
            room.onStateChange(onState);
            room.onLeave(onLeave);
            room.onError(onError);
            this.dispose.push(() => room.onStateChange.remove(onState), () => room.onLeave.remove(onLeave), () => room.onError.remove(onError));
            this.dispose.push(room.onMessage<InitialWorld>('world:initial', world => {
                if (this.initialReceived || this.closed) return;
                if (world.metadata.protocolVersion !== PROTOCOL_VERSION)
                {
                    this.fail('Incompatible server protocol.');
                    return;
                }
                this.initialReceived = true;
                clearTimeout(this.timeout);
                this.events.world(world);
                onState(room.state);
            }));
            this.dispose.push(room.onMessage<ChunkWindow>('world:chunks', window => {
                if (this.initialReceived && !this.closed) this.events.chunks(window);
            }));
            this.dispose.push(room.onMessage<AnimalUpdate>('world:animals', update => {
                if (this.initialReceived && !this.closed) this.events.animals(update);
            }));
            this.dispose.push(room.onMessage<PlayerCorrection>('player:correction', correction => {
                if (this.initialReceived && !this.closed) this.events.correction(correction);
            }));
            this.dispose.push(room.onMessage<string>('world:error', message => this.fail(message)));
            room.send('world:request');
        }
        catch (error)
        {
            this.fail(error instanceof Error ? error.message : 'Unable to connect to the server.');
        }
    }

    sendMovement(input: MovementCommand): void
    {
        if (!this.closed && this.initialReceived && this.room?.connection.isOpen)
        {
            this.room.send('player:input', input);
        }
    }

    close(): void
    {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.timeout);
        for (const dispose of this.dispose.splice(0)) dispose();
        if (this.room?.connection.isOpen) void this.room.leave().catch(() => undefined);
        this.room = undefined;
    }

    private fail(message: string): void
    {
        if (this.closed) return;
        this.close();
        this.events.disconnected(message);
    }
}
