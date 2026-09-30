import assert from 'node:assert/strict';
import test from 'node:test';
import { ChunkManager } from '../src/game/world/ChunkManager.ts';
import { generateChunk, chunkKey } from '../src/game/world/chunk.ts';
import { WORLD_CONFIG } from '../src/game/world/terrain.ts';

test('manager loads nine nearby chunks, changes only on crossing, and releases distant chunks', () => {
    const created = [];
    const destroyed = [];
    const manager = new ChunkManager(WORLD_CONFIG, chunk => {
        created.push(chunkKey(chunk.x, chunk.y));
        return chunk;
    }, chunk => destroyed.push(chunkKey(chunk.x, chunk.y)));

    manager.update(8, 8);
    assert.equal(manager.getLoadedKeys().length, 9);
    assert.ok(manager.getLoadedKeys().includes('0,0'));
    manager.update(511, 511);
    assert.equal(created.length, 9);

    manager.update(512, 8);
    assert.equal(created.length, 12);
    assert.equal(destroyed.length, 3);
    assert.equal(manager.getLoadedKeys().length, 9);

    manager.update(512, 512);
    assert.equal(created.length, 15);
    assert.equal(destroyed.length, 6);
    assert.equal(manager.getLoadedKeys().length, 9);

    manager.update(-1, -1);
    assert.equal(manager.getLoadedKeys().length, 9);
    assert.deepEqual(manager.getLoadedKeys().sort(),
        [-2, -1, 0].flatMap(y => [-2, -1, 0].map(x => chunkKey(x, y))).sort());

    manager.destroy();
    assert.equal(manager.getLoadedKeys().length, 0);
    assert.equal(destroyed.length, created.length);
});

test('a chunk regenerates identically after leaving and returning', () => {
    const visits = [];
    const manager = new ChunkManager(WORLD_CONFIG, chunk => {
        if (chunk.x === 0 && chunk.y === 0) visits.push(chunk);
        return chunk;
    }, () => {});

    manager.update(8, 8);
    manager.update(2 * 512, 8);
    manager.update(8, 8);
    assert.equal(visits.length, 2);
    assert.deepEqual(visits[0], visits[1]);
    assert.deepEqual(visits[0], generateChunk(WORLD_CONFIG, 0, 0));
    manager.destroy();
});

test('diagonal movement creates new chunks before releasing old ones', () => {
    const events = [];
    const manager = new ChunkManager(WORLD_CONFIG,
        chunk => {
            events.push(`create:${chunkKey(chunk.x, chunk.y)}`);
            return chunk;
        },
        chunk => events.push(`destroy:${chunkKey(chunk.x, chunk.y)}`));

    manager.update(8, 8);
    events.length = 0;
    manager.update(512, 512);
    assert.equal(events.filter(event => event.startsWith('create:')).length, 5);
    assert.equal(events.filter(event => event.startsWith('destroy:')).length, 5);
    assert.ok(events.slice(0, 5).every(event => event.startsWith('create:')));
    assert.equal(manager.getLoadedKeys().length, 9);
    manager.destroy();
});
