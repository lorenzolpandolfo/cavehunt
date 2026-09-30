import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Client } from '@colyseus/sdk';
import { startServer } from '../src/server.ts';
import { PROTOCOL_VERSION, ROOM_NAME } from '../../shared/src/protocol.ts';

async function until(condition) {
    const deadline = Date.now() + 5000;
    while (!condition()) {
        if (Date.now() > deadline) assert.fail('Timed out waiting for item update');
        await delay(20);
    }
}

async function connect(url, nickname) {
    const room = await new Client(url).join(ROOM_NAME, { nickname, protocolVersion: PROTOCOL_VERSION });
    const world = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Missing initial world')), 5000);
        room.onMessage('world:initial', value => { clearTimeout(timeout); resolve(value); });
        room.send('world:request');
    });
    await until(() => room.state.players?.has(world.playerId));
    return { room, world };
}

test('online collection, drop, late join and restart share persistent item state', { timeout: 30000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-item-network-'));
    const path = join(directory, 'world.json');
    let server = await startServer({ worldPath: path, port: 0, host: '127.0.0.1' });
    const rooms = [];
    t.after(async () => {
        for (const room of rooms) if (room.connection.isOpen) await room.leave().catch(() => undefined);
        await server.close();
        await rm(directory, { recursive: true, force: true });
    });
    let url = `http://127.0.0.1:${server.port}`;
    const alice = await connect(url, 'Alice');
    rooms.push(alice.room);
    const strawberry = alice.world.chunks.flatMap(chunk => chunk.items).find(item => item.itemId === 'strawberry');
    assert.ok(strawberry);
    const inventoryUpdates = [];
    const groundUpdates = [];
    alice.room.onMessage('item:inventory', value => inventoryUpdates.push(value));
    alice.room.onMessage('item:ground', value => groundUpdates.push(value));
    const start = alice.room.state.players.get('alice');
    const startX = start.x;
    const startY = start.y;
    const direction = strawberry.x > startX ? 'right' : 'left';
    const step = direction === 'right' ? 4 : -4;
    for (let sequence = 0; sequence < 6; sequence++) {
        alice.room.send('player:input', {
            left: direction === 'left', right: direction === 'right', up: false, down: false,
            boost: false, sequence, epoch: 0, x: startX + step * (sequence + 1), y: startY
        });
    }
    await until(() => inventoryUpdates.some(entries => entries.some(entry => entry.itemId === 'strawberry')));
    await until(() => groundUpdates.some(update => !update.items.some(item => item.id === strawberry.id)));
    const entry = inventoryUpdates.at(-1).find(item => item.itemId === 'strawberry');
    const bobby = await connect(url, 'Bobby');
    rooms.push(bobby.room);
    assert.ok(!bobby.world.chunks.flatMap(chunk => chunk.items).some(item => item.id === strawberry.id));
    const bobbyUpdates = [];
    bobby.room.onMessage('item:ground', value => bobbyUpdates.push(value));
    bobby.room.send('item:drop', { entryId: entry.id });
    await delay(100);
    assert.ok(!bobbyUpdates.some(update => update.items.some(item => item.id === entry.id)));
    alice.room.send('item:drop', { entryId: entry.id });
    await until(() => inventoryUpdates.at(-1).every(item => item.id !== entry.id));
    await until(() => bobbyUpdates.some(update => update.items.some(item => item.id === entry.id)));
    const disk = JSON.parse(await readFile(path, 'utf8'));
    assert.deepEqual(disk.players.alice.inventory, []);
    assert.ok(Object.values(disk.chunks).some(chunk => chunk.items.some(item => item.id === entry.id)));

    await Promise.all([alice.room.leave(), bobby.room.leave()]);
    await server.close();
    server = await startServer({ worldPath: path, port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${server.port}`;
    const recovered = await connect(url, 'Alice');
    rooms.push(recovered.room);
    assert.deepEqual(recovered.world.inventory, []);
    assert.ok(recovered.world.chunks.flatMap(chunk => chunk.items).some(item => item.id === entry.id));
    await delay(250);
    assert.ok(recovered.world.chunks.flatMap(chunk => chunk.items).some(item => item.id === entry.id));
});
