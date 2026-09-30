import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addressToTile, CHUNK_SIZE, chunkKey, chunkToTile, generateChunk,
    pixelToChunk, pixelToTile, tileToAddress, tileToChunk, tileToPixel
} from '../src/world/chunk.ts';
import { generateTerrainTile, WORLD_CONFIG } from '../src/world/terrain.ts';

test('pixel and tile coordinates cross positive and negative boundaries consistently', () => {
    for (const tile of [-65, -33, -32, -31, -1, 0, 1, 31, 32, 33, 64]) {
        assert.equal(pixelToTile(tileToPixel(tile)), tile);
        assert.equal(pixelToChunk(tileToPixel(tile)), tileToChunk(tile));
        assert.equal(pixelToChunk(tileToPixel(tile) + 15), tileToChunk(tile));
    }

    assert.equal(pixelToTile(-1), -1);
    assert.equal(pixelToChunk(-1), -1);
    assert.equal(pixelToChunk(-512), -1);
    assert.equal(pixelToChunk(-513), -2);
    assert.equal(pixelToChunk(511), 0);
    assert.equal(pixelToChunk(512), 1);
});

test('tile addresses round trip with local coordinates in range', () => {
    for (const y of [-65, -32, -1, 0, 31, 32, 65]) {
        for (const x of [-65, -32, -1, 0, 31, 32, 65]) {
            const address = tileToAddress(x, y);
            assert.deepEqual(addressToTile(address), { x, y });
            assert.ok(address.local.x >= 0 && address.local.x < CHUNK_SIZE);
            assert.ok(address.local.y >= 0 && address.local.y < CHUNK_SIZE);
        }
    }

    assert.deepEqual(tileToAddress(-1, -33), { chunk: { x: -1, y: -2 }, local: { x: 31, y: 31 } });
    assert.notEqual(chunkKey(1, 23), chunkKey(12, 3));
});

test('chunks reproduce independently of generation order and preserve global tile rules', () => {
    const positions = [[-1, -1], [0, 0], [1, 0], [0, -1]];
    const forward = positions.map(([x, y]) => generateChunk(WORLD_CONFIG, x, y));
    const reverse = [...positions].reverse();
    const reverseByKey = new Map(reverse.map(([x, y]) => [chunkKey(x, y), generateChunk(WORLD_CONFIG, x, y)]));

    for (const chunk of forward) {
        assert.deepEqual(chunk, reverseByKey.get(chunkKey(chunk.x, chunk.y)));
        assert.equal(chunk.tiles.length, CHUNK_SIZE);
        for (let y = 0; y < CHUNK_SIZE; y++) {
            assert.equal(chunk.tiles[y].length, CHUNK_SIZE);
            for (let x = 0; x < CHUNK_SIZE; x++) {
                assert.deepEqual(chunk.tiles[y][x], generateTerrainTile(WORLD_CONFIG, chunkToTile(chunk.x) + x, chunkToTile(chunk.y) + y));
            }
        }
    }
});
