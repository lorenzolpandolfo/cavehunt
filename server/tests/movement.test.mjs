import assert from 'node:assert/strict';
import test from 'node:test';
import { movePlayer, objectRectangle } from '../src/player/movement.ts';
import { idleMovement } from '../../shared/src/movement.ts';
import { OBJECT_FRAMES } from '../../cavehunt/src/game/world/objectFrames.ts';

const player = { x: 0, y: 0, direction: 'down', moving: false };
const intent = values => ({ ...idleMovement(), ...values });

test('authoritative speed is normalized and debug speed is bounded', () => {
    for (const input of [intent({ right: true }), intent({ left: true, up: true }), intent({ down: true })]) {
        const next = movePlayer(player, input, 50, []);
        assert.ok(Math.abs(Math.hypot(next.x, next.y) - 4) < 1e-9);
        assert.equal(next.moving, true);
        const boost = movePlayer(player, { ...input, boost: true }, 50, []);
        assert.ok(Math.abs(Math.hypot(boost.x, boost.y) - 12) < 1e-9);
    }
    assert.deepEqual(movePlayer(player, intent({ left: true, right: true }), 50, []), player);
    assert.deepEqual(movePlayer(player, idleMovement(), 50, []), player);
});

test('swept collisions stop on all sides without tunnelling through thin obstacles', () => {
    const obstacles = [{ left: 20, right: 30, top: -10, bottom: 10 }];
    assert.equal(movePlayer(player, intent({ right: true, boost: true }), 1000, obstacles).x, 14);
    assert.equal(movePlayer({ ...player, x: 60 }, intent({ left: true, boost: true }), 1000, obstacles).x, 36);
    assert.equal(movePlayer({ ...player, x: 24, y: -30 }, intent({ down: true }), 1000, obstacles).y, -13.5);
    assert.equal(movePlayer({ ...player, x: 24, y: 30 }, intent({ up: true }), 1000, obstacles).y, 13.5);
    const stopped = movePlayer({ ...player, x: 14 }, intent({ right: true }), 50, obstacles);
    assert.equal(stopped.x, 14);
    assert.equal(stopped.moving, false);
    const sliding = movePlayer({ ...player, x: 14 }, intent({ right: true, down: true }), 50, obstacles);
    assert.equal(sliding.x, 14);
    assert.ok(sliding.y > 0);
});

test('server bodies match sprite foot geometry, including negative tile positions', () => {
    for (const [type, frames] of Object.entries(OBJECT_FRAMES)) {
        const rectangle = objectRectangle({ type, x: -2, y: -1, variant: 0, id: 'fixture' });
        for (const frame of frames) {
            if (!frame.bodyWidth) assert.equal(rectangle, undefined);
            else {
                assert.equal(rectangle.right - rectangle.left, frame.bodyWidth);
                assert.equal(rectangle.bottom - rectangle.top, frame.bodyHeight);
                assert.equal(rectangle.bottom, 0);
                assert.equal((rectangle.left + rectangle.right) / 2, -24);
            }
        }
    }
});
