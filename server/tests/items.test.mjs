import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { WorldStore, writeWorldAtomically } from '../src/storage/WorldStore.ts';
import { worldFileSchema } from '../src/storage/worldFile.ts';

async function worldPath() {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-items-'));
    return { path: join(directory, 'world.json'), directory };
}

function groundItems(store, player) {
    return store.chunksFor(player).flatMap(chunk => chunk.items);
}

test('debug items spawn once; concurrent pickup, stack rules, drop and restart are durable', async t => {
    const { path, directory } = await worldPath();
    let store = await WorldStore.open(path);
    t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
    const alice = await store.preparePlayer('alice', 'Alice', () => []);
    const bobby = await store.preparePlayer('bobby', 'Bobby', () => [alice]);
    assert.deepEqual(groundItems(store, alice).map(item => item.itemId).sort(),
        ['strawberry', 'test_amulet', 'training_axe']);
    await store.close();

    const saved = JSON.parse(await readFile(path, 'utf8'));
    const strawberryChunk = Object.values(saved.chunks).find(chunk => chunk.items.some(item => item.itemId === 'strawberry'));
    const strawberry = strawberryChunk.items.find(item => item.itemId === 'strawberry');
    strawberryChunk.items.push({ ...strawberry, id: randomUUID(), x: strawberry.x + 1 });
    const axeChunk = Object.values(saved.chunks).find(chunk => chunk.items.some(item => item.itemId === 'training_axe'));
    const axe = axeChunk.items.find(item => item.itemId === 'training_axe');
    axeChunk.items.push({ ...axe, id: randomUUID(), x: axe.x + 1 });
    await writeFile(path, JSON.stringify(saved));
    store = await WorldStore.open(path);
    store.updatePosition('alice', strawberry.x, strawberry.y);
    await store.collectNearby('alice');
    await store.collectNearby('alice');
    const entry = store.inventoryFor('alice').find(item => item.itemId === 'strawberry');
    assert.equal(entry.quantity, 2);
    const dropped = await store.dropItem('alice', entry.id);
    assert.equal(dropped.update.items.at(-1).quantity, 1);
    assert.equal(store.inventoryFor('alice').filter(item => item.itemId === 'strawberry')
        .reduce((sum, item) => sum + item.quantity, 0), entry.quantity - 1);
    assert.equal(await store.collectNearby('alice'), undefined);

    store.updatePosition('alice', axe.x, axe.y);
    store.releaseOwnDrops('alice');
    assert.equal(groundItems(store, alice).find(item => item.id === dropped.update.items.at(-1).id).ownerMustLeave, false);
    await store.collectNearby('alice');
    await store.collectNearby('alice');
    store.updatePosition('alice', strawberry.x, strawberry.y);
    await store.collectNearby('alice');
    assert.equal(store.inventoryFor('alice').find(item => item.itemId === 'strawberry').quantity, 2);
    const axes = store.inventoryFor('alice').filter(item => item.itemId === 'training_axe');
    assert.equal(axes.length, 2);
    assert.ok(axes.every(item => item.quantity === 1));
    assert.notEqual(axes[0].id, axes[1].id);
    await store.close();

    store = await WorldStore.open(path);
    assert.equal(store.inventoryFor('alice').filter(item => item.itemId === 'training_axe').length, 2);
    assert.equal(groundItems(store, alice).filter(item => item.itemId === 'training_axe').length, 0);
    worldFileSchema.parse(JSON.parse(await readFile(path, 'utf8')));
});

test('concurrent players cannot collect the same ground item twice', async t => {
    const { path, directory } = await worldPath();
    const store = await WorldStore.open(path);
    t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
    const alice = await store.preparePlayer('alice', 'Alice', () => []);
    await store.preparePlayer('bobby', 'Bobby', () => [alice]);
    const strawberry = groundItems(store, alice).find(item => item.itemId === 'strawberry');
    store.updatePosition('alice', strawberry.x, strawberry.y);
    store.updatePosition('bobby', strawberry.x, strawberry.y);
    const claims = await Promise.all([store.collectNearby('alice'), store.collectNearby('bobby')]);
    assert.equal(claims.filter(Boolean).length, 1);
    const total = [...store.inventoryFor('alice'), ...store.inventoryFor('bobby')]
        .filter(item => item.itemId === 'strawberry').reduce((sum, item) => sum + item.quantity, 0);
    assert.equal(total, 1);
});

test('failed item commit leaves inventory and ground unchanged', async t => {
    const { path, directory } = await worldPath();
    let fail = false;
    const store = await WorldStore.open(path, async (target, data) => {
        if (fail) throw new Error('disk full');
        await writeWorldAtomically(target, data);
    });
    t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
    const alice = await store.preparePlayer('alice', 'Alice', () => []);
    const strawberry = groundItems(store, alice).find(item => item.itemId === 'strawberry');
    store.updatePosition('alice', strawberry.x, strawberry.y);
    await store.flush();
    const before = await readFile(path, 'utf8');
    fail = true;
    await assert.rejects(store.collectNearby('alice'), /disk full/);
    assert.deepEqual(store.inventoryFor('alice'), []);
    assert.ok(groundItems(store, alice).some(item => item.id === strawberry.id));
    assert.equal(await readFile(path, 'utf8'), before);
    fail = false;
    await store.collectNearby('alice');
    const entry = store.inventoryFor('alice')[0];
    const collected = await readFile(path, 'utf8');
    fail = true;
    await assert.rejects(store.dropItem('alice', entry.id), /disk full/);
    assert.deepEqual(store.inventoryFor('alice'), [entry]);
    assert.equal(await readFile(path, 'utf8'), collected);
    fail = false;
});
