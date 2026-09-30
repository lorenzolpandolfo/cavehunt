import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateVelocity } from '../src/game/player/movement.ts';

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

test('debug speed keeps diagonal movement normalized at triple speed', () => {
    const normal = calculateVelocity({ left: false, right: true, up: true, down: false }, SPEED, { x: 0, y: 0 });
    const fast = calculateVelocity({ left: false, right: true, up: true, down: false }, SPEED * 3, { x: 0, y: 0 });
    assert.ok(Math.abs(Math.hypot(fast.x, fast.y) - SPEED * 3) < 1e-10);
    assert.ok(Math.abs(fast.x - normal.x * 3) < 1e-10);
    assert.ok(Math.abs(fast.y - normal.y * 3) < 1e-10);
});
