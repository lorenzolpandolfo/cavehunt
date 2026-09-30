import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorldStore, writeWorldAtomically } from '../src/storage/WorldStore.ts';
import { worldFileSchema } from '../src/storage/worldFile.ts';
import { CHUNK_SIZE } from '../../shared/src/coordinates.ts';
import { getSurface } from '../src/world/surface.ts';

const cleanups = new WeakMap();

async function temporary(t) {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-store-'));
    cleanups.set(t, []);
    t.after(async () => {
        try { for (const cleanup of cleanups.get(t).reverse()) await cleanup(); }
        finally { await rm(directory, { recursive: true, force: true }); }
    });
    return join(directory, 'world.json');
}

test('world round-trip retains complete chunks, surface borders, animals and players', async t => {
    const path = await temporary(t);
    const store = await WorldStore.open(path);
    const alice = await store.preparePlayer('alice', 'Alice', () => []);
    const chunks = store.chunksFor(alice);
    assert.equal(chunks.length, 9);
    for (const chunk of chunks) {
        assert.equal(chunk.surfaces.length, CHUNK_SIZE + 2);
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
            for (let x = 0; x < CHUNK_SIZE + 2; x++) {
                assert.equal(chunk.surfaces[y][x], getSurface(chunk.config, chunk.x * CHUNK_SIZE + x - 1, chunk.y * CHUNK_SIZE + y - 1));
            }
        }
    }
    const metadata = store.metadata;
    await store.close();
    const saved = JSON.parse(await readFile(path, 'utf8'));
    worldFileSchema.parse(saved);
    const restored = await WorldStore.open(path);
    cleanups.get(t).push(() => restored.close());
    assert.deepEqual(restored.metadata, metadata);
    const recovered = await restored.preparePlayer('alice', 'ALICE', () => []);
    assert.deepEqual(recovered, alice);
    assert.deepEqual(restored.chunksFor(recovered), chunks);
    assert.equal('online' in saved.players.alice, false);
});

test('exclusive file lock rejects a second writer and is released on close', async t => {
    const path = await temporary(t);
    const store = await WorldStore.open(path);
    await assert.rejects(WorldStore.open(path), { code: 'EEXIST' });
    await store.close();
    const next = await WorldStore.open(path);
    await next.close();
});

test('malformed and unsupported saves are preserved and release the lock', async t => {
    const path = await temporary(t);
    for (const raw of ['{', JSON.stringify({ saveVersion: 99 }), JSON.stringify({ saveVersion: 1, config: { generatorVersion: 999 } })]) {
        await writeFile(path, raw);
        await assert.rejects(WorldStore.open(path));
        assert.equal(await readFile(path, 'utf8'), raw);
        await assert.rejects(readFile(`${path}.lock`), { code: 'ENOENT' });
    }
});

test('queued admissions do not overwrite one another and reuse generated chunks', async t => {
    const path = await temporary(t);
    const store = await WorldStore.open(path);
    cleanups.get(t).push(() => store.close());
    const players = await Promise.all(Array.from({ length: 8 }, (_, index) => store.preparePlayer(`player${index}`, `Player${index}`, () => [])));
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(Object.keys(saved.players).length, 8);
    assert.strictEqual(store.chunksFor(players[0])[0], store.chunksFor(players[1])[0]);
});

test('failed writes leave both committed file and in-memory world unchanged; retry succeeds', async t => {
    const path = await temporary(t);
    let fail = false;
    const store = await WorldStore.open(path, async (target, data) => {
        if (fail) throw new Error('disk full');
        await writeWorldAtomically(target, data);
    });
    cleanups.get(t).push(() => store.close());
    const before = await readFile(path, 'utf8');
    fail = true;
    await assert.rejects(store.preparePlayer('alice', 'Alice', () => []), /disk full/);
    assert.equal(await readFile(path, 'utf8'), before);
    fail = false;
    await store.preparePlayer('bobby', 'Bobby', () => []);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.deepEqual(Object.keys(saved.players), ['bobby']);
});

test('movement during a chunk commit is not rolled back and remains dirty until flushed', async t => {
    const path = await temporary(t);
    let gate;
    let entered;
    const store = await WorldStore.open(path, async (target, data) => {
        if (gate) {
            entered.resolve();
            await gate.promise;
        }
        await writeWorldAtomically(target, data);
    });
    cleanups.get(t).push(() => store.close());
    await store.preparePlayer('alice', 'Alice', () => []);
    store.updatePosition('alice', 12, 8);
    gate = Promise.withResolvers();
    entered = Promise.withResolvers();
    const loading = store.ensureWindow({ x: 1024, y: 512 });
    await entered.promise;
    assert.equal(store.hasWindow({ x: 1024, y: 512 }), false);
    store.updatePosition('alice', 16, 8);
    gate.resolve();
    await loading;
    gate = undefined;
    assert.equal(store.hasWindow({ x: 1024, y: 512 }), true);
    await store.flush();
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(saved.players.alice.x, 16);
    assert.ok(saved.chunks['3,2']);
});

test('failed chunk generation commit never becomes available to the simulation', async t => {
    const path = await temporary(t);
    let fail = false;
    const store = await WorldStore.open(path, async (target, data) => {
        if (fail) throw new Error('disk full');
        await writeWorldAtomically(target, data);
    });
    cleanups.get(t).push(() => store.close());
    await store.preparePlayer('alice', 'Alice', () => []);
    const before = await readFile(path, 'utf8');
    fail = true;
    await assert.rejects(store.ensureWindow({ x: 2048, y: 2048 }), /disk full/);
    assert.equal(store.hasWindow({ x: 2048, y: 2048 }), false);
    await assert.rejects(store.flush(true), /disk full/);
    assert.equal(await readFile(path, 'utf8'), before);
    fail = false;
});

test('allowed nicknames that resemble object properties survive restart', async t => {
    const path = await temporary(t);
    const store = await WorldStore.open(path);
    for (const id of ['constructor', '__proto__', 'tostring']) {
        await store.preparePlayer(id, id, () => []);
        store.updatePosition(id, 24, 8);
    }
    await store.close();
    const restored = await WorldStore.open(path);
    cleanups.get(t).push(() => restored.close());
    for (const id of ['constructor', '__proto__', 'tostring']) {
        const player = await restored.preparePlayer(id, id, () => []);
        assert.equal(player.id, id);
        assert.equal(player.x, 24);
    }
    assert.equal(Object.keys(JSON.parse(await readFile(path, 'utf8')).players).length, 3);
});
