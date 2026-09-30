import { idleMovement, type MovementIntent } from '../../../../shared/src/movement.ts';

const CONTROL_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export class PlayerInput
{
    private readonly held = new Set<string>();
    private readonly onStop: () => void;
    private readonly target: Window;
    private readonly visibility: Document;

    constructor(onStop: () => void, target: Window = window, visibility: Document = document)
    {
        this.onStop = onStop;
        this.target = target;
        this.visibility = visibility;
        target.addEventListener('keydown', this.onKeyDown);
        target.addEventListener('keyup', this.onKeyUp);
        target.addEventListener('blur', this.stop);
        target.addEventListener('focus', this.stop);
        visibility.addEventListener('visibilitychange', this.onVisibility);
    }

    current(): MovementIntent
    {
        if (this.visibility.hidden) return idleMovement();
        return {
            left: this.held.has('KeyA') || this.held.has('ArrowLeft'),
            right: this.held.has('KeyD') || this.held.has('ArrowRight'),
            up: this.held.has('KeyW') || this.held.has('ArrowUp'),
            down: this.held.has('KeyS') || this.held.has('ArrowDown'),
            boost: this.held.has('ShiftLeft') || this.held.has('ShiftRight')
        };
    }

    destroy(): void
    {
        this.stop();
        this.target.removeEventListener('keydown', this.onKeyDown);
        this.target.removeEventListener('keyup', this.onKeyUp);
        this.target.removeEventListener('blur', this.stop);
        this.target.removeEventListener('focus', this.stop);
        this.visibility.removeEventListener('visibilitychange', this.onVisibility);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void =>
    {
        if (!CONTROL_KEYS.has(event.code)) return;
        event.preventDefault();
        if (!this.visibility.hidden) this.held.add(event.code);
    };

    private readonly onKeyUp = (event: KeyboardEvent): void =>
    {
        if (!CONTROL_KEYS.has(event.code)) return;
        event.preventDefault();
        this.held.delete(event.code);
    };

    private readonly onVisibility = (): void =>
    {
        if (this.visibility.hidden) this.stop();
    };

    private readonly stop = (): void =>
    {
        this.held.clear();
        this.onStop();
    };
}
