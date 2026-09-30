import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Client } from '@colyseus/sdk';
import { startServer } from '../src/server.ts';
import { WorldStore } from '../src/storage/WorldStore.ts';
import { PROTOCOL_VERSION, ROOM_NAME } from '../../shared/src/protocol.ts';
import { hasGroundFootprint } from '../src/world/animals.ts';

async function until(condition) {
    const deadline = Date.now() + 6000;
    while (!condition()) {
        if (Date.now() > deadline) assert.fail('Timed out waiting for animal updates');
        await delay(20);
    }
}

async function connect(url, nickname) {
    const room = await new Client(url).join(ROOM_NAME, { nickname, protocolVersion: PROTOCOL_VERSION });
    room.reconnection.enabled = false;
    room.onMessage('world:animals', () => undefined);
    const world = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Initial world not received')), 6000);
        room.onMessage('world:initial', value => { clearTimeout(timeout); resolve(value); });
        room.send('world:request');
    });
    return { room, world };
}

test('animal movement follows active chunks, reaches nearby clients, pauses and survives restart', { timeout: 30000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-animal-network-'));
    const worldPath = join(directory, 'world.json');
    let server;
    const rooms = [];
    t.after(async () => {
        for (const room of rooms) if (room.connection.isOpen) await room.leave().catch(() => {});
        await server?.close();
        await rm(directory, { recursive: true, force: true });
    });

    const setup = await WorldStore.open(worldPath);
    await setup.preparePlayer('carol', 'Carol', () => []);
    await setup.ensureWindow({ x: 4096, y: 4096 });
    setup.updatePosition('carol', 4096, 4096);
    await setup.close();
    const fixture = JSON.parse(await readFile(worldPath, 'utf8'));
    const animal = fixture.chunks['0,0'].animals[0];
    assert.ok(animal);
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const direction = directions.findIndex(([dx, dy]) => hasGroundFootprint(fixture.config, animal.type, animal.x + dx * 8, animal.y + dy * 8));
    assert.ok(direction >= 0);
    animal.phase = 'walk';
    animal.direction = direction;
    animal.remainingMs = 1200;
    const starting = structuredClone(animal);
    await writeFile(worldPath, JSON.stringify(fixture));

    server = await startServer({ worldPath, port: 0, host: '127.0.0.1' });
    let url = `http://127.0.0.1:${server.port}`;
    const [alice, bobby, carol] = await Promise.all([
        connect(url, 'Alice'), connect(url, 'Bobby'), connect(url, 'Carol')
    ]);
    rooms.push(alice.room, bobby.room, carol.room);
    const aliceUpdates = [];
    const bobbyUpdates = [];
    const carolUpdates = [];
    alice.room.onMessage('world:animals', update => aliceUpdates.push(update));
    bobby.room.onMessage('world:animals', update => bobbyUpdates.push(update));
    carol.room.onMessage('world:animals', update => carolUpdates.push(update));
    await until(() => aliceUpdates.some(update => update.x === 0 && update.y === 0 &&
        update.animals.some(value => value.id === animal.id && (value.x !== starting.x || value.y !== starting.y))));
    await until(() => bobbyUpdates.some(update => update.x === 0 && update.y === 0));
    const shared = aliceUpdates.find(update => update.x === 0 && update.y === 0 &&
        bobbyUpdates.some(other => other.x === 0 && other.y === 0 &&
            other.animals.find(value => value.id === animal.id)?.x === update.animals.find(value => value.id === animal.id)?.x));
    assert.ok(shared);
    assert.ok(!carolUpdates.some(update => update.x === 0 && update.y === 0));
    assert.ok(carol.world.chunks.every(chunk => chunk.x >= 7 && chunk.x <= 9));

    const dave = await connect(url, 'Dave');
    rooms.push(dave.room);
    const current = dave.world.chunks.find(chunk => chunk.x === 0 && chunk.y === 0).animals.find(value => value.id === animal.id);
    assert.ok(current.x !== starting.x || current.y !== starting.y);
    assert.ok(current.remainingMs < starting.remainingMs || current.phase !== starting.phase);

    await Promise.all([alice.room.leave(), bobby.room.leave(), carol.room.leave(), dave.room.leave()]);
    const paused = JSON.parse(await readFile(worldPath, 'utf8')).chunks['0,0'].animals;
    await delay(300);
    assert.deepEqual(JSON.parse(await readFile(worldPath, 'utf8')).chunks['0,0'].animals, paused);

    await server.close();
    server = await startServer({ worldPath, port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${server.port}`;
    const recovered = await connect(url, 'Alice');
    rooms.push(recovered.room);
    assert.deepEqual(recovered.world.chunks.find(chunk => chunk.x === 0 && chunk.y === 0).animals, paused);
});
