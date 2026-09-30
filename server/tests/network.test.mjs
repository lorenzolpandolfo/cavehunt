import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Client } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { startServer } from '../src/server.ts';
import { PROTOCOL_VERSION, ROOM_NAME } from '../../shared/src/protocol.ts';
import { pixelToChunk } from '../../shared/src/coordinates.ts';
import { movePlayer, objectRectangle } from '../../shared/src/playerMovement.ts';
import { idleMovement } from '../../shared/src/movement.ts';
import { WorldConnection } from '../../cavehunt/src/game/network/WorldConnection.ts';

async function until(condition) {
    const deadline = Date.now() + 6000;
    while (!condition()) {
        if (Date.now() > deadline) assert.fail('Timed out waiting for synchronized state');
        await delay(20);
    }
}

async function connect(url, nickname) {
    const room = await new Client(url).join(ROOM_NAME, { nickname, protocolVersion: PROTOCOL_VERSION });
    room.reconnection.enabled = false;
    room.onMessage('world:animals', () => undefined);
    const world = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Initial world not received')), 6000);
        room.onMessage('world:initial', data => { clearTimeout(timeout); resolve(data); });
        room.send('world:request');
    });
    await until(() => room.state.players?.has(world.playerId));
    return { room, world };
}

test('online world integration', { timeout: 40000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-network-'));
    const worldPath = join(directory, 'world.json');
    let server;
    const rooms = [];
    t.after(async () => {
        for (const room of rooms) if (room.connection.isOpen) await room.leave().catch(() => {});
        await server?.close();
        await rm(directory, { recursive: true, force: true });
    });
    server = await startServer({ worldPath, port: 0, host: '127.0.0.1', maxPlayers: 4 });
    let url = `http://127.0.0.1:${server.port}`;
    const [alice, bobby] = await Promise.all([connect(url, ' Alice '), connect(url, 'Bobby')]);
    rooms.push(alice.room, bobby.room);
    await until(() => alice.room.state.players.size === 2 && bobby.room.state.players.size === 2);
    assert.equal(alice.room.roomId, bobby.room.roomId);
    assert.equal(alice.world.metadata.worldId, bobby.world.metadata.worldId);
    let alicePosition = { x: alice.room.state.players.get('alice').x, y: alice.room.state.players.get('alice').y };
    let aliceChunks = alice.world.chunks;
    const bobPosition = bobby.room.state.players.get('bobby');
    assert.ok(Math.hypot(alicePosition.x - bobPosition.x, alicePosition.y - bobPosition.y) >= 32);
    const commonChunk = bobby.world.chunks.find(chunk => alice.world.chunks.some(other => other.x === chunk.x && other.y === chunk.y));
    assert.deepEqual(commonChunk, alice.world.chunks.find(chunk => chunk.x === commonChunk.x && chunk.y === commonChunk.y));
    const disk = JSON.parse(await readFile(worldPath, 'utf8'));
    assert.equal(Object.keys(disk.players).length, 2);
    assert.ok(disk.chunks['0,0']);

    await t.test('nickname and protocol validation and singleton room', async () => {
        await assert.rejects(connect(url, 'ALICE'), /already connected/);
        await assert.rejects(connect(url, 'a!'), /Invalid nickname/);
        await assert.rejects(new Client(url).join(ROOM_NAME, { nickname: 'Valid', protocolVersion: 999 }), /protocol/);
        await assert.rejects(new Client(url).create(ROOM_NAME, {}), /already exists/);
        assert.equal((await matchMaker.query({ name: ROOM_NAME })).length, 1);
    });

    await t.test('late arrival gets existing players and only one duplicate admission succeeds', async () => {
        const attempts = await Promise.allSettled([connect(url, 'Carol'), connect(url, 'CAROL')]);
        assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
        const carol = attempts.find(result => result.status === 'fulfilled').value;
        rooms.push(carol.room);
        await until(() => carol.room.state.players.size === 3);
        assert.equal(carol.room.state.players.get('alice').nickname, 'Alice');
        await carol.room.leave();
        await until(() => alice.room.state.players.size === 2);
    });

    await t.test('capacity rejects additional clients without creating another world', async () => {
        const extra = await Promise.all([connect(url, 'Erika'), connect(url, 'Felix')]);
        rooms.push(...extra.map(client => client.room));
        await until(() => alice.room.state.players.size === 4);
        await assert.rejects(connect(url, 'Grace'));
        assert.equal((await matchMaker.query({ name: ROOM_NAME })).length, 1);
        await Promise.all(extra.map(client => client.room.leave()));
        await until(() => alice.room.state.players.size === 2);
    });

    await t.test('actual client adapter receives state and cleans up after disconnect', async () => {
        let world;
        let players = [];
        const animalUpdates = [];
        const connection = new WorldConnection(url, {
            chunks: () => {}, animals: update => animalUpdates.push(update),
            inventory: () => {}, groundItems: () => {},
            world: value => { world = value; }, players: value => { players = value; },
            correction: () => {},
            disconnected: reason => assert.fail(reason)
        });
        await connection.connect('David');
        await until(() => world && players.length === 3);
        assert.equal(world.playerId, 'david');
        await until(() => animalUpdates.length > 0);
        assert.ok(world.chunks.some(chunk => animalUpdates.some(update =>
            update.x === chunk.x && update.y === chunk.y && update.animals.length > 0)));
        connection.close();
        await until(() => !alice.room.state.players.has('david'));
    });

    await t.test('validated client positions reach peers and invalid positions trigger corrections', async () => {
        let chunkWindow;
        let observerWindows = 0;
        let obstacles = aliceChunks.flatMap(chunk => chunk.objects.flatMap(object => {
            const rectangle = objectRectangle(object);
            return rectangle ? [rectangle] : [];
        }));
        const remove = alice.room.onMessage('world:chunks', message => {
            chunkWindow = message;
            obstacles = message.chunks.flatMap(chunk => chunk.objects.flatMap(object => {
                const rectangle = objectRectangle(object);
                return rectangle ? [rectangle] : [];
            }));
        });
        const removeObserver = bobby.room.onMessage('world:chunks', () => observerWindows++);
        const startX = alicePosition.x;
        const startY = alicePosition.y;
        const input = { left: startX >= 0, right: startX < 0, up: false, down: false, boost: true };
        let correction;
        const removeCorrection = alice.room.onMessage('player:correction', message => { correction = message; });
        alice.room.send('player:input', { ...input, x: 999999, y: startY, epoch: 0, sequence: 1 });
        await until(() => correction?.epoch === 1);
        assert.equal(alice.room.state.players.get('alice').x, alicePosition.x);
        let sequence = 2;
        let reported = { ...alice.room.state.players.get('alice') };
        const sendStep = intent => {
            reported = movePlayer(reported, intent, 50, obstacles);
            alice.room.send('player:input', { ...intent, x: reported.x, y: reported.y, epoch: 1, sequence: sequence++ });
        };
        const movement = setInterval(() => sendStep(input), 50);
        try {
            await until(() => pixelToChunk(alice.room.state.players.get('alice').x) !== pixelToChunk(startX) && chunkWindow);
        } finally {
            clearInterval(movement);
        }
        sendStep(idleMovement());
        const stopSequence = sequence - 1;
        await until(() => !alice.room.state.players.get('alice').moving);
        await until(() => alice.room.state.players.get('alice').lastProcessedSequence === stopSequence);
        const stopped = alice.room.state.players.get('alice').x;
        alice.room.send('player:input', { ...input, x: 999999, y: startY, epoch: 0, sequence: 1 });
        await delay(120);
        assert.equal(alice.room.state.players.get('alice').x, stopped);
        await until(() => bobby.room.state.players.get('alice').x === stopped);
        assert.equal(bobby.room.state.players.get('alice').lastProcessedSequence, stopSequence);
        assert.equal(chunkWindow.chunks.length, 9);
        assert.deepEqual(chunkWindow.chunks.map(chunk => `${chunk.x},${chunk.y}`).sort(),
            [-1, 0, 1].flatMap(y => [-1, 0, 1].map(x => `${pixelToChunk(stopped) + x},${pixelToChunk(startY) + y}`)).sort());
        assert.equal(observerWindows, 0);
        sendStep({ ...idleMovement(), down: true });
        await until(() => alice.room.state.players.get('alice').moving);
        await until(() => !alice.room.state.players.get('alice').moving);
        const position = alice.room.state.players.get('alice');
        alicePosition = { x: position.x, y: position.y };
        assert.ok(alicePosition.y > startY && alicePosition.y <= startY + 48);
        aliceChunks = chunkWindow.chunks;
        remove();
        removeObserver();
        removeCorrection();
    });

    await t.test('socket loss removes presence and releases the nickname', async () => {
        bobby.room.connection.close();
        await until(() => !alice.room.state.players.has('bobby'));
        const returned = await connect(url, 'BOBBY');
        rooms.push(returned.room);
        assert.equal(returned.room.state.players.get('bobby').nickname, 'Bobby');
        await returned.room.leave();
    });

    await t.test('restart recovers world and player without persisted presence', async () => {
        await alice.room.leave();
        await server.close();
        server = await startServer({ worldPath, port: 0, host: '127.0.0.1' });
        url = `http://127.0.0.1:${server.port}`;
        const restored = await connect(url, 'ALICE');
        rooms.push(restored.room);
        assert.equal(restored.world.metadata.worldId, alice.world.metadata.worldId);
        assert.equal(restored.room.state.players.size, 1);
        const player = restored.room.state.players.get('alice');
        assert.deepEqual({ x: player.x, y: player.y }, alicePosition);
        const terrain = chunks => chunks.map(({ animals: _animals, ...chunk }) => chunk);
        assert.deepEqual(terrain(restored.world.chunks), terrain(aliceChunks));
    });
});
