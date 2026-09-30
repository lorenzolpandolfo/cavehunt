import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from './server.ts';

const worldPath = process.env.WORLD_FILE
    ? resolve(process.env.WORLD_FILE)
    : fileURLToPath(new URL('../data/world.json', import.meta.url));

try
{
    const server = await startServer({
        worldPath,
        port: Number(process.env.PORT ?? 2567),
        host: process.env.HOST ?? '0.0.0.0',
        maxPlayers: Number(process.env.MAX_PLAYERS ?? 16)
    });
    console.log(`Cavehunt server listening on port ${server.port}. World: ${worldPath}`);
    const shutdown = () => {
        void server.close().then(() => process.exit(0)).catch(error => {
            console.error('Failed to shut down:', error);
            process.exit(1);
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
catch (error)
{
    console.error('Cannot start Cavehunt server:', error);
    process.exitCode = 1;
}
