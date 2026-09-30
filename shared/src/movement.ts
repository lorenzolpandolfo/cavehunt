export interface MovementInput {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
}

export interface Velocity {
    x: number;
    y: number;
}

export function calculateVelocity(input: MovementInput, speed: number, result: Velocity): Velocity
{
    const x = Number(input.right) - Number(input.left);
    const y = Number(input.down) - Number(input.up);
    const length = Math.hypot(x, y);

    result.x = length === 0 ? 0 : x * speed / length;
    result.y = length === 0 ? 0 : y * speed / length;

    return result;
}

export const SIMULATION_STEP_MS = 50;
export const INPUT_TIMEOUT_MS = 500;
export const INPUT_HEARTBEAT_MS = 100;
export const PLAYER_SPEED = 80;
export const DEBUG_SPEED_MULTIPLIER = 3;
export const PLAYER_BODY_WIDTH = 12;
export const PLAYER_BODY_HEIGHT = 7;
export const PLAYER_FEET_OFFSET = 17.5;

export type Direction = 'down' | 'up' | 'left' | 'right';

export interface MovementIntent extends MovementInput {
    boost: boolean;
}

export interface MovementCommand extends MovementIntent {
    sequence: number;
}

export function idleMovement(): MovementIntent
{
    return { left: false, right: false, up: false, down: false, boost: false };
}
