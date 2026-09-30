import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '../../shared/src/protocol.ts';
import { WorldStore } from './storage/WorldStore.ts';
import { createWorldRoom } from './network/WorldRoom.ts';

export interface ServerOptions {
    worldPath: string;
    port: number;
    host?: string;
    maxPlayers?: number;
}

export async function startServer(options: ServerOptions)
{
    const maxPlayers = options.maxPlayers ?? 16;
    if (!Number.isSafeInteger(maxPlayers) || maxPlayers < 1) throw new Error('MAX_PLAYERS must be a positive integer');
    if (!Number.isSafeInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('Invalid PORT');
    const store = await WorldStore.open(options.worldPath);
    const transport = new WebSocketTransport({ pingInterval: 3000, pingMaxRetries: 2, maxPayload: 4096 });
    const server = new Server({
        transport, greet: false, gracefullyShutdown: false,
        beforeListen: async () => {
            await matchMaker.onReady;
            await matchMaker.createRoom(ROOM_NAME, {});
        }
    });
    server.define(ROOM_NAME, createWorldRoom(store, maxPlayers));
    let shutdown: Promise<void> | undefined;
    const close = () => {
        shutdown ??= (async () => {
            try { await server.gracefullyShutdown(false); }
            finally { await store.close(); }
        })();
        return shutdown;
    };
    try
    {
        await server.listen(options.port, options.host ?? '0.0.0.0');
        const address = transport.server?.address();
        if (!address || typeof address === 'string') throw new Error('Server address unavailable');
        return { port: address.port, close };
    }
    catch (error)
    {
        await close();
        throw error;
    }
}
