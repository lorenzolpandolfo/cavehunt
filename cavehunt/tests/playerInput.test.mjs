import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerInput } from '../src/game/player/PlayerInput.ts';

function key(target, type, code) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'code', { value: code });
    target.dispatchEvent(event);
}

test('input heartbeats preserve held directions and stop on blur, hidden tab and cleanup', () => {
    const target = new EventTarget();
    const visibility = new EventTarget();
    visibility.hidden = false;
    const sent = [];
    const controls = new PlayerInput(value => sent.push(value), target, visibility);
    key(target, 'keydown', 'KeyD');
    key(target, 'keydown', 'ArrowUp');
    key(target, 'keydown', 'ShiftLeft');
    controls.update(50);
    assert.deepEqual(sent.at(-1), { left: false, right: true, up: true, down: false, boost: true });
    const count = sent.length;
    controls.update(50);
    assert.equal(sent.length, count);
    controls.update(50);
    assert.equal(sent.length, count + 1);
    target.dispatchEvent(new Event('blur'));
    assert.ok(Object.values(sent.at(-1)).every(value => value === false));
    controls.update(100);
    assert.equal(sent.at(-1).right, false);
    key(target, 'keydown', 'KeyA');
    visibility.hidden = true;
    visibility.dispatchEvent(new Event('visibilitychange'));
    assert.equal(sent.at(-1).left, false);
    controls.destroy();
    const after = sent.length;
    target.dispatchEvent(new Event('blur'));
    assert.equal(sent.length, after);
});
