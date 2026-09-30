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
