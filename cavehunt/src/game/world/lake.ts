import { hashWorld } from './worldHash.ts';
import { type WorldConfig } from './worldConfig.ts';

const LAKE_CELL_SIZE = 64;
const LAKE_CHANCE = 75;
const LAKE_JITTER = 8;
const PRESENCE_SALT = 0x8e4a6d15;
const X_SALT = 0xc337a21f;
const Y_SALT = 0x5ad91e63;
const WIDTH_SALT = 0x7b519d42;
const HEIGHT_SALT = 0x2ce86f39;
const SHAPE_SALT = 0xd4f61a8b;

export interface Lake {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    phase: number;
}

export function generateLake(config: WorldConfig, cellX: number, cellY: number): Lake | undefined
{
    if (hashWorld(config, cellX, cellY, PRESENCE_SALT) % 100 >= LAKE_CHANCE)
    {
        return undefined;
    }

    return {
        centerX: cellX * LAKE_CELL_SIZE + LAKE_CELL_SIZE / 2 +
            hashWorld(config, cellX, cellY, X_SALT) % (LAKE_JITTER * 2 + 1) - LAKE_JITTER,
        centerY: cellY * LAKE_CELL_SIZE + LAKE_CELL_SIZE / 2 +
            hashWorld(config, cellX, cellY, Y_SALT) % (LAKE_JITTER * 2 + 1) - LAKE_JITTER,
        radiusX: 11 + hashWorld(config, cellX, cellY, WIDTH_SALT) % 7,
        radiusY: 10 + hashWorld(config, cellX, cellY, HEIGHT_SALT) % 7,
        phase: hashWorld(config, cellX, cellY, SHAPE_SALT) / 0xffffffff * Math.PI * 2
    };
}

function containsTile(lake: Lake, tileX: number, tileY: number): boolean
{
    const dx = tileX - lake.centerX;
    const dy = tileY - lake.centerY;
    const angle = Math.atan2(dy, dx);
    const shoreline = 1 + 0.06 * Math.sin(3 * angle + lake.phase) +
        0.04 * Math.sin(5 * angle - lake.phase);

    return Math.hypot(dx / lake.radiusX, dy / lake.radiusY) <= shoreline;
}

export function isLakeTile(config: WorldConfig, tileX: number, tileY: number): boolean
{
    const cellX = Math.floor(tileX / LAKE_CELL_SIZE);
    const cellY = Math.floor(tileY / LAKE_CELL_SIZE);
    const lake = generateLake(config, cellX, cellY);
    return lake !== undefined && containsTile(lake, tileX, tileY);
}
