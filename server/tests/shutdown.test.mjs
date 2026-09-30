import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
import { worldFileSchema } from '../src/storage/worldFile.ts';

test('SIGINT saves the world and removes its lock', { timeout: 15000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-shutdown-'));
    const worldPath = join(directory, 'world.json');
    const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
        cwd: join(import.meta.dirname, '../..'),
        env: { ...process.env, WORLD_FILE: worldPath, PORT: '0', HOST: '127.0.0.1' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
            await once(child, 'exit');
        }
        await rm(directory, { recursive: true, force: true });
    });

    let output = '';
    await new Promise((resolve, reject) => {
        child.stdout.on('data', chunk => {
            output += chunk;
            if (output.includes('Cavehunt server listening')) resolve();
        });
        child.once('error', reject);
        child.once('exit', () => reject(new Error(`Server exited before listening: ${output}`)));
    });

    child.kill('SIGINT');
    const [code, signal] = await once(child, 'exit');
    assert.equal(code, 0);
    assert.equal(signal, null);
    worldFileSchema.parse(JSON.parse(await readFile(worldPath, 'utf8')));
    await assert.rejects(readFile(`${worldPath}.lock`), { code: 'ENOENT' });
});
