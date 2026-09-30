import assert from 'node:assert/strict';
import test from 'node:test';
import { generateChunk, tileToAddress } from '../src/world/chunk.ts';
import { getRiverSection, getRiverSurface } from '../src/world/river.ts';
import { generateTerrainTile, WORLD_CONFIG } from '../src/world/terrain.ts';
import { generateWorldObject } from '../src/world/worldObjects.ts';

test('river rows connect by sides and stay continuous across positive and negative chunks', () => {
    const chunks = new Map();

    for (let riverIndex = -2; riverIndex <= 2; riverIndex++) {
        let previous = getRiverSection(WORLD_CONFIG, riverIndex, -257);

        for (let y = -256; y <= 256; y++) {
            const section = getRiverSection(WORLD_CONFIG, riverIndex, y);
            assert.ok(section.maxX >= previous.minX && section.minX <= previous.maxX);
            assert.ok(section.maxX - section.minX + 1 >= 3 && section.maxX - section.minX + 1 <= 5);

            for (let x = section.minX; x <= section.maxX; x++) {
                assert.equal(getRiverSurface(WORLD_CONFIG, x, y), 'water');
                assert.equal(generateTerrainTile(WORLD_CONFIG, x, y).surface, 'water');

                const address = tileToAddress(x, y);
                const key = `${address.chunk.x},${address.chunk.y}`;
                if (!chunks.has(key)) chunks.set(key, generateChunk(WORLD_CONFIG, address.chunk.x, address.chunk.y));
                const chunk = chunks.get(key);
                assert.equal(chunk.tiles[address.local.y][address.local.x].surface, 'water');
            }

            previous = section;
        }
    }
});

test('rivers appear frequently and no objects spawn in water', () => {
    const starts = [];
    for (let x = -128; x <= 128; x++) {
        if (getRiverSurface(WORLD_CONFIG, x, 0) === 'water' &&
            getRiverSurface(WORLD_CONFIG, x - 1, 0) === 'ground') starts.push(x);
    }
    assert.ok(starts.length >= 5);

    for (let cellY = -48; cellY <= 48; cellY++) {
        for (let cellX = -80; cellX <= 80; cellX++) {
            const object = generateWorldObject(WORLD_CONFIG, cellX, cellY);
            if (object) {
                if (object.type !== 'waterLily') {
                    assert.equal(getRiverSurface(WORLD_CONFIG, object.x, object.y), 'ground');
                }
            }
        }
    }
});

test('spawn clearing stays distant from water for supported seeds', () => {
    for (const seed of ['cavehunt', 'world-a', 'world-b']) {
        for (let y = -4; y <= 4; y++) {
            for (let x = -4; x <= 4; x++) {
                assert.equal(getRiverSurface({ ...WORLD_CONFIG, seed }, x, y), 'ground');
            }
        }
    }
});
