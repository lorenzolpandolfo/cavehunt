import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorldStore } from '../src/storage/WorldStore.ts';
import { advanceAnimal } from '../src/world/animals.ts';

test('overlapping interest advances one stored population per simulation step', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cavehunt-animal-step-'));
    const store = await WorldStore.open(join(directory, 'world.json'));
    t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
    const alice = await store.preparePlayer('alice', 'Alice', () => []);
    const bobby = await store.preparePlayer('bobby', 'Bobby', () => [alice]);
    const common = store.chunksFor(alice).find(chunk => chunk.animals.length > 0 &&
        store.chunksFor(bobby).some(other => other.x === chunk.x && other.y === chunk.y));
    assert.ok(common);
    const key = `${common.x},${common.y}`;
    const expected = structuredClone(common.animals);
    for (const animal of expected) advanceAnimal(common.config, animal, 100);
    const keys = new Set([...store.chunksFor(alice), ...store.chunksFor(bobby)].map(chunk => `${chunk.x},${chunk.y}`));
    assert.ok(keys.has(key));
    store.advanceAnimals(keys, 100);
    assert.deepEqual(common.animals, expected);
    const paused = structuredClone(common.animals);
    store.advanceAnimals(new Set(), 1000);
    assert.deepEqual(common.animals, paused);
});
