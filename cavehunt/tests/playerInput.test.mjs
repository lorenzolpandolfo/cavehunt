import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerInput } from '../src/game/player/PlayerInput.ts';

function key(target, type, code) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'code', { value: code });
    target.dispatchEvent(event);
}

test('held directions are available immediately and stop on blur, hidden tab and cleanup', () => {
    const target = new EventTarget();
    const visibility = new EventTarget();
    visibility.hidden = false;
    let stops = 0;
    const controls = new PlayerInput(() => stops++, target, visibility);
    key(target, 'keydown', 'KeyD');
    key(target, 'keydown', 'ArrowUp');
    key(target, 'keydown', 'ShiftLeft');
    assert.deepEqual(controls.current(), { left: false, right: true, up: true, down: false, boost: true });
    key(target, 'keyup', 'ArrowUp');
    assert.equal(controls.current().up, false);
    target.dispatchEvent(new Event('blur'));
    assert.equal(stops, 1);
    assert.ok(Object.values(controls.current()).every(value => value === false));
    key(target, 'keydown', 'KeyA');
    visibility.hidden = true;
    visibility.dispatchEvent(new Event('visibilitychange'));
    assert.equal(stops, 2);
    assert.equal(controls.current().left, false);
    controls.destroy();
    assert.equal(stops, 3);
    target.dispatchEvent(new Event('blur'));
    assert.equal(stops, 3);
});
