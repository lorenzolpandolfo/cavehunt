import { INPUT_HEARTBEAT_MS, SIMULATION_STEP_MS, idleMovement, type MovementIntent } from '../../../../shared/src/movement.ts';

const CONTROL_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export class PlayerInput
{
    private readonly held = new Set<string>();
    private elapsed = INPUT_HEARTBEAT_MS;
    private last = '';
    private readonly send: (input: MovementIntent) => void;
    private readonly target: Window;
    private readonly visibility: Document;

    constructor(send: (input: MovementIntent) => void, target: Window = window, visibility: Document = document)
    {
        this.send = send;
        this.target = target;
        this.visibility = visibility;
        target.addEventListener('keydown', this.onKeyDown);
        target.addEventListener('keyup', this.onKeyUp);
        target.addEventListener('blur', this.stop);
        target.addEventListener('focus', this.stop);
        visibility.addEventListener('visibilitychange', this.onVisibility);
    }

    update(deltaMs: number): void
    {
        this.elapsed += deltaMs;
        const input: MovementIntent = {
            left: this.held.has('KeyA') || this.held.has('ArrowLeft'),
            right: this.held.has('KeyD') || this.held.has('ArrowRight'),
            up: this.held.has('KeyW') || this.held.has('ArrowUp'),
            down: this.held.has('KeyS') || this.held.has('ArrowDown'),
            boost: this.held.has('ShiftLeft') || this.held.has('ShiftRight')
        };
        const key = JSON.stringify(input);
        if (this.elapsed >= SIMULATION_STEP_MS && (key !== this.last || this.elapsed >= INPUT_HEARTBEAT_MS))
        {
            this.send(input);
            this.last = key;
            this.elapsed = 0;
        }
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
        const input = idleMovement();
        this.send(input);
        this.last = JSON.stringify(input);
        this.elapsed = 0;
    };
}
