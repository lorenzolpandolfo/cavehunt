import assert from 'node:assert/strict';
import test from 'node:test';
import { ChunkManager } from '../src/game/world/ChunkManager.ts';

const windowAt = (x, y) => [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ x: x + dx, y: y + dy })));

test('received snapshots are idempotent and release chunks outside the new window', () => {
    const created = [];
    const destroyed = [];
    const manager = new ChunkManager(chunk => { created.push(chunk); return chunk; }, chunk => destroyed.push(chunk));
    manager.apply(windowAt(0, 0));
    manager.apply(windowAt(0, 0));
    assert.equal(created.length, 9);
    assert.equal(destroyed.length, 0);
    manager.apply(windowAt(-1, 0));
    assert.equal(created.length, 12);
    assert.equal(destroyed.length, 3);
    assert.equal(manager.getLoadedKeys().length, 9);
    manager.destroy();
    manager.destroy();
    assert.equal(destroyed.length, 12);
    assert.deepEqual(manager.getLoadedKeys(), []);
});
