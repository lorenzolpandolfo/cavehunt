import assert from 'node:assert/strict';
import test from 'node:test';
import { shoreTileIndex } from '../src/game/world/shore.ts';

function tileFor(water) {
    const neighbors = new Set(water.map(([x, y]) => `${x},${y}`));
    return shoreTileIndex((x, y) => neighbors.has(`${x},${y}`));
}

test('shore tiles round tips, narrow strips, and isolated ground', () => {
    const cases = [
        { name: 'north tip', water: [[0, -1], [-1, 0], [1, 0]], tile: 3 },
        { name: 'south tip', water: [[0, 1], [-1, 0], [1, 0]], tile: 25 },
        { name: 'west tip', water: [[0, -1], [0, 1], [-1, 0]], tile: 33 },
        { name: 'east tip', water: [[0, -1], [0, 1], [1, 0]], tile: 35 },
        { name: 'vertical strip', water: [[-1, 0], [1, 0]], tile: 14 },
        { name: 'horizontal strip', water: [[0, -1], [0, 1]], tile: 34 },
        { name: 'isolated ground', water: [[0, -1], [0, 1], [-1, 0], [1, 0]], tile: 36 }
    ];

    for (const { name, water, tile } of cases) {
        assert.equal(tileFor(water), tile, name);
    }
});

test('ordinary shore tiles retain their existing corners and sides', () => {
    const cases = [
        { water: [], tile: 12 },
        { water: [[0, -1]], tile: 1 },
        { water: [[0, 1]], tile: 23 },
        { water: [[-1, 0]], tile: 11 },
        { water: [[1, 0]], tile: 13 },
        { water: [[0, -1], [-1, 0]], tile: 0 },
        { water: [[0, -1], [1, 0]], tile: 2 },
        { water: [[0, 1], [-1, 0]], tile: 22 },
        { water: [[0, 1], [1, 0]], tile: 24 }
    ];

    for (const { water, tile } of cases) {
        assert.equal(tileFor(water), tile, JSON.stringify(water));
    }
});

test('diagonal water selects each inner corner without replacing an outer shore', () => {
    const corners = [
        { name: 'top left', water: [-1, -1], tile: 28 },
        { name: 'top right', water: [1, -1], tile: 27 },
        { name: 'bottom left', water: [-1, 1], tile: 17 },
        { name: 'bottom right', water: [1, 1], tile: 16 }
    ];

    for (const { name, water, tile } of corners) {
        assert.equal(tileFor([water]), tile, name);
        assert.equal(tileFor([water, [0, -1]]), 1, `${name} with a northern shore`);
    }
});
