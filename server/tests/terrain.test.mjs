import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTerrainTile, GENERATOR_VERSION } from '../src/world/terrain.ts';

const config = { seed: 'world-a', generatorVersion: GENERATOR_VERSION };

test('biomes repeat for a fixed seed and change with a different seed', () => {
    const tiles = (seed) => Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => generateTerrainTile({ seed, generatorVersion: GENERATOR_VERSION }, x, y)));

    assert.deepEqual(tiles(config.seed), tiles(config.seed));
    assert.notDeepEqual(tiles(config.seed), tiles('world-b'));
    assert.throws(() => generateTerrainTile({ seed: config.seed, generatorVersion: 1 }, 0, 0));
});

test('spawn is forest and wide samples contain both biomes', () => {
    const biomes = new Set();

    for (let y = -128; y <= 128; y += 8) {
        for (let x = -128; x <= 128; x += 8) {
            biomes.add(generateTerrainTile(config, x, y).biome);
        }
    }

    assert.deepEqual([...biomes].sort(), ['forest', 'plain']);
    assert.equal(generateTerrainTile(config, 0, 0).biome, 'forest');
    assert.equal(generateTerrainTile(config, 0, 0).surface, 'ground');
});

test('biome blend is continuous across chunk edges', () => {
    for (const y of [-64, 0, 64]) {
        const left = generateTerrainTile(config, 31, y).forestBlend;
        const right = generateTerrainTile(config, 32, y).forestBlend;
        assert.ok(Math.abs(right - left) < 0.05);
    }
});
