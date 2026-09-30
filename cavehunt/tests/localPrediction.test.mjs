import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalPrediction } from '../src/game/player/LocalPrediction.ts';
import { idleMovement } from '../../shared/src/movement.ts';

const initial = { id: 'alice', nickname: 'Alice', x: 0, y: 0, direction: 'down', moving: false, lastProcessedSequence: -1 };
const intent = values => ({ ...idleMovement(), ...values });

function createMovement(obstacles = [], canEnter = () => true) {
    const sent = [];
    const movement = new LocalPrediction(initial, () => obstacles, canEnter, command => sent.push(command));
    return { movement, sent };
}

test('local motion starts within a frame and reports normalized positions and Shift speed', () => {
    const { movement, sent } = createMovement();
    const first = movement.advance(16, intent({ right: true }));
    assert.ok(first.x > 0 && first.x < 1.28);
    assert.equal(sent.length, 0);
    const diagonal = movement.advance(34, intent({ right: true, up: true }));
    assert.ok(Math.hypot(diagonal.x, diagonal.y) < 4);
    assert.ok(Math.abs(Math.hypot(sent[0].x, sent[0].y) - 4) < 1e-9);
    assert.equal(sent[0].sequence, 0);
    assert.equal(sent[0].epoch, 0);
    const boosted = movement.advance(50, intent({ right: true, up: true, boost: true }));
    assert.ok(Math.abs(Math.hypot(sent[1].x - sent[0].x, sent[1].y - sent[0].y) - 12) < 1e-9);
    assert.ok(boosted.x < sent[1].x);
});

test('local collision blocks movement and missing target chunks hold position', () => {
    const { movement, sent } = createMovement([{ left: 20, right: 30, top: -10, bottom: 10 }]);
    const blocked = movement.advance(250, intent({ right: true, boost: true }));
    assert.ok(blocked.x <= 14);
    assert.equal(sent.at(-1).x, 14);
    const limited = createMovement([], x => x < 4);
    assert.equal(limited.movement.advance(50, intent({ right: true })).x, 0);
    assert.equal(limited.sent[0].x, 0);
});

test('only explicit corrections alter local position and advance the validation epoch', () => {
    const { movement, sent } = createMovement();
    assert.ok(movement.advance(50, intent({ right: true })).x < 4);
    movement.correct({ x: 3, y: 0, direction: 'right', moving: true, epoch: 1 });
    assert.ok(movement.advance(0, idleMovement()).x > 3);
    assert.ok(Math.abs(movement.advance(100, idleMovement()).x - 3) < 0.02);
    assert.equal(sent.at(-1).epoch, 1);
    movement.correct({ x: -20, y: 0, direction: 'right', moving: false, epoch: 2 });
    assert.equal(movement.advance(0, idleMovement()).x, -20);
    movement.correct({ x: 99, y: 0, direction: 'right', moving: false, epoch: 1 });
    assert.equal(movement.advance(0, idleMovement()).x, -20);
});

test('visual motion eases in and settles after input stops while reports remain exact', () => {
    const { movement, sent } = createMovement();
    const first = movement.advance(16, intent({ right: true }));
    assert.ok(first.x > 0 && first.x < 1.28);
    movement.advance(34, intent({ right: true }));
    assert.equal(sent[0].x, 4);
    const atRelease = movement.advance(16, idleMovement());
    assert.ok(atRelease.x > first.x && atRelease.x < 4);
    const settling = movement.advance(34, idleMovement());
    assert.ok(settling.x > atRelease.x && settling.x < 4);
    assert.deepEqual({ x: sent[1].x, y: sent[1].y }, { x: 4, y: 0 });
    assert.ok(Math.abs(movement.advance(150, idleMovement()).x - 4) < 0.05);
});

test('stop sends the current local position and an idle command', () => {
    const { movement, sent } = createMovement();
    movement.advance(50, intent({ right: true }));
    movement.stop();
    assert.deepEqual(sent.map(command => command.sequence), [0, 1]);
    assert.deepEqual(sent[1], { ...idleMovement(), x: 4, y: 0, sequence: 1, epoch: 0 });
    assert.equal(movement.advance(0, idleMovement()).x, 4);
});
