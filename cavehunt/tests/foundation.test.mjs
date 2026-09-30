import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateVelocity } from '../src/game/player/movement.ts';
import { FOUNDATION_MAP, isBlockedTile, isInsideMap, isWalkableTile } from '../src/game/world/foundationMap.ts';

const SPEED = 80;

function velocity(left = false, right = false, up = false, down = false) {
    return calculateVelocity({ left, right, up, down }, SPEED, { x: 0, y: 0 });
}

test('movement has the same speed in all eight directions', () => {
    const directions = [
        [true, false, false, false], [false, true, false, false],
        [false, false, true, false], [false, false, false, true],
        [true, false, true, false], [true, false, false, true],
        [false, true, true, false], [false, true, false, true]
    ];

    for (const direction of directions) {
        const { x, y } = velocity(...direction);
        assert.ok(Math.abs(Math.hypot(x, y) - SPEED) < 1e-10);
    }
});

test('rest and opposing inputs have zero velocity', () => {
    assert.deepEqual(velocity(), { x: 0, y: 0 });
    assert.deepEqual(velocity(true, true), { x: 0, y: 0 });
    assert.deepEqual(velocity(false, false, true, true), { x: 0, y: 0 });
    assert.deepEqual(velocity(true, true, true, false), { x: 0, y: -SPEED });
});

test('foundation map dimensions, bounds and spawn are valid', () => {
    const map = FOUNDATION_MAP;
    assert.equal(map.width, 64);
    assert.equal(map.height, 48);
    assert.ok(isInsideMap(map, map.spawn.x, map.spawn.y));
    assert.ok(isWalkableTile(map, map.spawn.x, map.spawn.y));
    assert.equal(isInsideMap(map, -1, 2), false);
    assert.equal(isInsideMap(map, map.width, 2), false);
    assert.equal(isInsideMap(map, 1.5, 2), false);
    assert.equal(isBlockedTile(map, 0, 0), true);
    assert.equal(isBlockedTile(map, map.width - 1, map.height - 1), true);
});

test('blocked areas and obstacles are within the map and away from spawn', () => {
    const map = FOUNDATION_MAP;

    for (const area of map.blockedAreas) {
        assert.ok(area.width > 0 && area.height > 0);
        assert.ok(isInsideMap(map, area.x, area.y));
        assert.ok(isInsideMap(map, area.x + area.width - 1, area.y + area.height - 1));
        assert.equal(map.spawn.x >= area.x && map.spawn.x < area.x + area.width && map.spawn.y >= area.y && map.spawn.y < area.y + area.height, false);
    }

    for (const tree of map.trees) {
        assert.ok(isInsideMap(map, tree.x, tree.y));
        assert.equal(isBlockedTile(map, tree.x, tree.y), false);
        assert.notDeepEqual(tree, map.spawn);
    }
});
