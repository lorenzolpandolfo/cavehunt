import assert from 'node:assert/strict';
import test from 'node:test';
import { generateChunk, tileToAddress } from '../src/game/world/chunk.ts';
import { generateLake, isLakeTile } from '../src/game/world/lake.ts';
import { getSurface } from '../src/game/world/surface.ts';
import { WORLD_CONFIG } from '../src/game/world/worldConfig.ts';
import { generateWorldObject } from '../src/game/world/worldObjects.ts';

test('lakes repeat for a seed and vary with a different seed', () => {
    const sample = config => Array.from({ length: 49 }, (_, index) =>
        generateLake(config, index % 7 - 3, Math.floor(index / 7) - 3));

    assert.deepEqual(sample(WORLD_CONFIG), sample(WORLD_CONFIG));
    assert.notDeepEqual(sample(WORLD_CONFIG), sample({ ...WORLD_CONFIG, seed: 'other-world' }));
    assert.ok(sample(WORLD_CONFIG).filter(Boolean).length >= 30);
});

test('lake water crosses chunk boundaries without changing on regeneration', () => {
    let seam;

    for (let cellY = -3; cellY <= 3 && !seam; cellY++) {
        for (let cellX = -3; cellX <= 3 && !seam; cellX++) {
            const lake = generateLake(WORLD_CONFIG, cellX, cellY);
            if (!lake) continue;

            for (let y = lake.centerY - lake.radiusY; y <= lake.centerY + lake.radiusY && !seam; y++) {
                const boundary = Math.floor(lake.centerX / 32) * 32;
                if (isLakeTile(WORLD_CONFIG, boundary - 1, y) && isLakeTile(WORLD_CONFIG, boundary, y)) {
                    seam = { x: boundary, y };
                }
            }
        }
    }

    assert.ok(seam);
    for (const x of [seam.x - 1, seam.x]) {
        const address = tileToAddress(x, seam.y);
        const first = generateChunk(WORLD_CONFIG, address.chunk.x, address.chunk.y);
        const second = generateChunk(WORLD_CONFIG, address.chunk.x, address.chunk.y);
        assert.deepEqual(first, second);
        assert.equal(first.tiles[address.local.y][address.local.x].surface, 'water');
    }
});

test('lake tiles are connected and leave spawn and objects on ground', () => {
    for (let cellY = -2; cellY <= 2; cellY++) {
        for (let cellX = -2; cellX <= 2; cellX++) {
            const lake = generateLake(WORLD_CONFIG, cellX, cellY);
            if (!lake) continue;

            const points = new Set();
            for (let y = lake.centerY - 20; y <= lake.centerY + 20; y++) {
                for (let x = lake.centerX - 20; x <= lake.centerX + 20; x++) {
                    if (isLakeTile(WORLD_CONFIG, x, y)) points.add(`${x},${y}`);
                }
            }

            const visited = new Set();
            const queue = [[lake.centerX, lake.centerY]];
            for (const [x, y] of queue) {
                const key = `${x},${y}`;
                if (visited.has(key) || !points.has(key)) continue;
                visited.add(key);
                queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
            }
            assert.equal(visited.size, points.size);
        }
    }

    for (const seed of ['cavehunt', 'world-a', 'world-b']) {
        const config = { ...WORLD_CONFIG, seed };
        for (let y = -4; y <= 4; y++) {
            for (let x = -4; x <= 4; x++) {
                assert.equal(getSurface(config, x, y), 'ground');
            }
        }
    }

    for (let cellY = -32; cellY <= 32; cellY++) {
        for (let cellX = -32; cellX <= 32; cellX++) {
            const object = generateWorldObject(WORLD_CONFIG, cellX, cellY);
            if (object && object.type !== 'waterLily') {
                assert.equal(isLakeTile(WORLD_CONFIG, object.x, object.y), false);
            }
        }
    }
});
