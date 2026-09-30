import { TILE_SIZE } from './coordinates.ts';
import { OBJECT_BODIES } from './collision.ts';
import { type WorldObject } from './protocol.ts';
import {
    calculateVelocity, PLAYER_SPEED, DEBUG_SPEED_MULTIPLIER, PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT,
    type Direction, type MovementIntent
} from './movement.ts';

export interface Rectangle {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface MovingPlayer {
    x: number;
    y: number;
    direction: Direction;
    moving: boolean;
}

export function objectRectangle(object: WorldObject): Rectangle | undefined
{
    const body = OBJECT_BODIES[object.type];
    if (!body) return undefined;
    const x = (object.x + 0.5) * TILE_SIZE;
    const bottom = (object.y + 1) * TILE_SIZE;
    return { left: x - body.bodyWidth / 2, right: x + body.bodyWidth / 2, top: bottom - body.bodyHeight, bottom };
}

export function movePlayer(player: MovingPlayer, input: MovementIntent, deltaMs: number, obstacles: readonly Rectangle[]): MovingPlayer
{
    const velocity = calculateVelocity(input, PLAYER_SPEED * (input.boost ? DEBUG_SPEED_MULTIPLIER : 1), { x: 0, y: 0 });
    const dx = velocity.x * deltaMs / 1000;
    const dy = velocity.y * deltaMs / 1000;
    const halfWidth = PLAYER_BODY_WIDTH / 2;
    const halfHeight = PLAYER_BODY_HEIGHT / 2;
    let x = player.x + dx;
    for (const obstacle of obstacles)
    {
        if (player.y + halfHeight <= obstacle.top || player.y - halfHeight >= obstacle.bottom) continue;
        if (dx > 0 && player.x + halfWidth <= obstacle.left && x + halfWidth > obstacle.left) x = Math.min(x, obstacle.left - halfWidth);
        if (dx < 0 && player.x - halfWidth >= obstacle.right && x - halfWidth < obstacle.right) x = Math.max(x, obstacle.right + halfWidth);
    }
    let y = player.y + dy;
    for (const obstacle of obstacles)
    {
        if (x + halfWidth <= obstacle.left || x - halfWidth >= obstacle.right) continue;
        if (dy > 0 && player.y + halfHeight <= obstacle.top && y + halfHeight > obstacle.top) y = Math.min(y, obstacle.top - halfHeight);
        if (dy < 0 && player.y - halfHeight >= obstacle.bottom && y - halfHeight < obstacle.bottom) y = Math.max(y, obstacle.bottom + halfHeight);
    }
    const direction = velocity.x > 0 ? 'right' : velocity.x < 0 ? 'left' : velocity.y > 0 ? 'down' : velocity.y < 0 ? 'up' : player.direction;
    return { x, y, direction, moving: x !== player.x || y !== player.y };
}
