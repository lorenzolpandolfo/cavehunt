import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceAnimal, AnimalPopulation, generateChunkAnimals, hasGroundFootprint } from '../src/game/world/animals.ts';
import { TILE_SIZE } from '../src/game/world/chunk.ts';
import { getSurface } from '../src/game/world/surface.ts';
import { generateTerrainTile, WORLD_CONFIG } from '../src/game/world/terrain.ts';
import { getRiverSurface } from '../src/game/world/river.ts';
import { isLakeTile } from '../src/game/world/lake.ts';

test('animal sheets use the intended frame sizes', () => {
    for (const [type, width, height] of [['cow', 96, 64], ['chicken', 64, 32]]) {
        const png = readFileSync(new URL(`../public/assets/mobs/${type}.png`, import.meta.url));
        assert.equal(png.readUInt32BE(16), width);
        assert.equal(png.readUInt32BE(20), height);
    }
});

test('animals generate reproducibly, favor plains, and start entirely on land', () => {
    const counts = { plain: 0, forest: 0 };
    const candidates = { plain: 0, forest: 0 };
    const groupSizes = { cow: new Set(), chicken: new Set() };
    const ids = new Set();
    let totalAnimals = 0;

    for (let chunkY = -12; chunkY <= 12; chunkY++) {
        for (let chunkX = -12; chunkX <= 12; chunkX++) {
            const animals = generateChunkAnimals(WORLD_CONFIG, chunkX, chunkY);
            assert.deepEqual(animals, generateChunkAnimals(WORLD_CONFIG, chunkX, chunkY));
            totalAnimals += animals.length;

            for (const type of ['cow', 'chicken']) {
                const group = animals.filter(animal => animal.type === type);
                assert.ok(group.length === 0 ||
                    (type === 'cow' ? [3, 5] : [2, 5]).includes(group.length));
                if (group.length > 0) groupSizes[type].add(group.length);
            }

            for (const animal of animals) {
                assert.equal(ids.has(animal.id), false);
                ids.add(animal.id);
                assert.equal(hasGroundFootprint(WORLD_CONFIG, animal.type, animal.x, animal.y), true);
                assert.ok(animal.x >= chunkX * 32 * TILE_SIZE && animal.x < (chunkX + 1) * 32 * TILE_SIZE);
                assert.ok(animal.y >= chunkY * 32 * TILE_SIZE && animal.y < (chunkY + 1) * 32 * TILE_SIZE);
                counts[generateTerrainTile(WORLD_CONFIG, Math.floor(animal.x / TILE_SIZE), Math.floor(animal.y / TILE_SIZE)).biome]++;
            }

            for (let tileY = chunkY * 32 + 3; tileY < chunkY * 32 + 29; tileY += 4) {
                for (let tileX = chunkX * 32 + 3; tileX < chunkX * 32 + 29; tileX += 4) {
                    if (getSurface(WORLD_CONFIG, tileX, tileY) === 'ground') {
                        candidates[generateTerrainTile(WORLD_CONFIG, tileX, tileY).biome]++;
                    }
                }
            }
        }
    }

    assert.ok(counts.plain > 0 && counts.forest > 0);
    assert.ok(counts.plain / candidates.plain > counts.forest / candidates.forest * 1.5);
    assert.ok(totalAnimals > 2 * 25 * 25);
    assert.deepEqual([...groupSizes.cow].sort(), [3, 5]);
    assert.deepEqual([...groupSizes.chicken].sort(), [2, 5]);
});

test('walking pauses before entering rivers and lakes', () => {
    for (const waterAt of [
        (x, y) => getRiverSurface(WORLD_CONFIG, x, y) === 'water',
        (x, y) => isLakeTile(WORLD_CONFIG, x, y)
    ]) {
        let animal;

        for (let tileY = -80; tileY <= 80 && !animal; tileY++) {
            for (let tileX = -80; tileX <= 80 && !animal; tileX++) {
                const x = (tileX + 0.5) * TILE_SIZE;
                const y = (tileY + 0.75) * TILE_SIZE;

                if (hasGroundFootprint(WORLD_CONFIG, 'chicken', x, y) &&
                    waterAt(tileX + 1, tileY) &&
                    !hasGroundFootprint(WORLD_CONFIG, 'chicken', x + TILE_SIZE, y)) {
                    animal = {
                        id: 'test', type: 'chicken', homeX: x, homeY: y, x, y,
                        phase: 'walk', direction: 0, remainingMs: 2000, decisionIndex: 0
                    };
                }
            }
        }

        assert.ok(animal);
        advanceAnimal(WORLD_CONFIG, animal, 1000);
        assert.equal(animal.phase, 'idle');
        assert.equal(hasGroundFootprint(WORLD_CONFIG, animal.type, animal.x, animal.y), true);
        const stoppedX = animal.x;
        advanceAnimal(WORLD_CONFIG, animal, 100);
        assert.equal(animal.x, stoppedX);
    }
});

test('loaded animals retain their position and pause state across chunk unloads', () => {
    const population = new AnimalPopulation(WORLD_CONFIG);
    let chunk;

    for (let chunkY = -3; chunkY <= 3 && !chunk; chunkY++) {
        for (let chunkX = -3; chunkX <= 3 && !chunk; chunkX++) {
            if (generateChunkAnimals(WORLD_CONFIG, chunkX, chunkY).length > 0) chunk = [chunkX, chunkY];
        }
    }

    assert.ok(chunk);
    const [chunkX, chunkY] = chunk;
    const animals = population.load(chunkX, chunkY);
    animals[0].phase = 'walk';
    animals[0].direction = 0;
    animals[0].remainingMs = 1000;
    population.update(100);
    const snapshot = structuredClone(animals);

    population.unload(chunkX, chunkY);
    population.update(1000);
    assert.deepEqual(animals, snapshot);
    assert.strictEqual(population.load(chunkX, chunkY), animals);
    assert.deepEqual(animals, snapshot);

    population.destroy();
    assert.deepEqual(population.load(chunkX, chunkY), generateChunkAnimals(WORLD_CONFIG, chunkX, chunkY));
    population.destroy();
});
