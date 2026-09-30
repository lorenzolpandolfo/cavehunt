import assert from 'node:assert/strict';
import test from 'node:test';
import { generateChunk, tileToChunk } from '../src/game/world/chunk.ts';
import { generateTerrainTile, WORLD_CONFIG } from '../src/game/world/terrain.ts';
import { generateChunkObjects, generateWorldObject } from '../src/game/world/worldObjects.ts';
import { OBJECT_FRAMES } from '../src/game/world/objectFrames.ts';
import { readFileSync } from 'node:fs';

test('tree and decoration frames fit the source atlas', () => {
    const atlas = readFileSync(new URL('../public/assets/sprout-lands/biome-objects.png', import.meta.url));
    const width = atlas.readUInt32BE(16);
    const height = atlas.readUInt32BE(20);
    assert.equal(width, 144);
    assert.equal(height, 80);

    for (const frames of Object.values(OBJECT_FRAMES)) {
        for (const frame of frames) {
            assert.ok(frame.x >= 0 && frame.y >= 0);
            assert.ok(frame.x + frame.width <= width);
            assert.ok(frame.y + frame.height <= height);
        }
    }

    assert.deepEqual(OBJECT_FRAMES.tree.map(frame => [frame.x, frame.width, frame.height]),
        [[16, 32, 32], [48, 32, 32]]);
    assert.deepEqual(OBJECT_FRAMES.strawberryBush[0],
        { x: 0, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 });
    assert.deepEqual(OBJECT_FRAMES.plainBush[0],
        { x: 16, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 });
    assert.ok(Object.values(OBJECT_FRAMES).flat().every(frame =>
        !(frame.y === 32 && (frame.x === 0 || frame.x === 16)) &&
        !(frame.y === 64 && frame.x === 36)));
});

test('objects have stable identities, cell spacing and a clear spawn', () => {
    const ids = new Set();
    const occupiedCells = new Set();

    for (let chunkY = -3; chunkY <= 3; chunkY++) {
        for (let chunkX = -3; chunkX <= 3; chunkX++) {
            const objects = generateChunkObjects(WORLD_CONFIG, chunkX, chunkY);
            assert.deepEqual(objects, generateChunk(WORLD_CONFIG, chunkX, chunkY).objects);

            for (const object of objects) {
                assert.equal(tileToChunk(object.x), chunkX);
                assert.equal(tileToChunk(object.y), chunkY);
                assert.equal(Math.abs(object.x) <= 4 && Math.abs(object.y) <= 4, false);
                assert.equal(ids.has(object.id), false);
                ids.add(object.id);
                const cell = `${Math.floor(object.x / 4)},${Math.floor(object.y / 4)}`;
                assert.equal(occupiedCells.has(cell), false);
                occupiedCells.add(cell);
                assert.deepEqual(object, generateWorldObject(WORLD_CONFIG, Math.floor(object.x / 4), Math.floor(object.y / 4)));
            }
        }
    }
});

test('forest cells contain more trees than plain cells in a broad sample', () => {
    const counts = { forest: { trees: 0, cells: 0 }, plain: { trees: 0, cells: 0 } };
    const types = new Set();
    const surfaces = new Set();

    for (let cellY = -64; cellY <= 64; cellY++) {
        for (let cellX = -64; cellX <= 64; cellX++) {
            const object = generateWorldObject(WORLD_CONFIG, cellX, cellY);
            const x = cellX * 4 + 2;
            const y = cellY * 4 + 2;
            const biome = generateTerrainTile(WORLD_CONFIG, x, y).biome;
            counts[biome].cells++;
            if (object) types.add(object.type);
            if (object) {
                const surface = generateTerrainTile(WORLD_CONFIG, object.x, object.y).surface;
                assert.equal(surface, object.type === 'waterLily' ? 'water' : 'ground');
                surfaces.add(surface);
            }
            if (object?.type === 'tree') counts[biome].trees++;
        }
    }

    assert.ok(counts.forest.cells > 0 && counts.plain.cells > 0);
    assert.ok(counts.forest.trees / counts.forest.cells > counts.plain.trees / counts.plain.cells * 2);
    assert.deepEqual([...types].sort(), Object.keys(OBJECT_FRAMES).sort());
    assert.deepEqual([...surfaces].sort(), ['ground', 'water']);
});
