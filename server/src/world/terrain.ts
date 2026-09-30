import { getSurface } from './surface.ts';
import { hashWorld } from './worldHash.ts';
import { type WorldConfig } from './worldConfig.ts';

export { GENERATOR_VERSION, WORLD_CONFIG, WORLD_SEED } from './worldConfig.ts';
export type { WorldConfig } from './worldConfig.ts';

const BIOME_SCALE = 64;
const BIOME_THRESHOLD = 0.5;
const SPAWN_FOREST_RADIUS = 32;
const SPAWN_FOREST_STRENGTH = 0.85;
const BIOME_SALT = 0x6b39a5d1;

import { type TerrainTile } from '../../../shared/src/protocol.ts';
export type { Biome, TerrainTile, Surface } from '../../../shared/src/protocol.ts';

function smoothStep(value: number): number
{
    return value * value * (3 - 2 * value);
}

function lerp(from: number, to: number, amount: number): number
{
    return from + (to - from) * amount;
}

function biomeNoise(config: WorldConfig, tileX: number, tileY: number): number
{
    const cellX = Math.floor(tileX / BIOME_SCALE);
    const cellY = Math.floor(tileY / BIOME_SCALE);
    const fractionX = smoothStep((tileX - cellX * BIOME_SCALE) / BIOME_SCALE);
    const fractionY = smoothStep((tileY - cellY * BIOME_SCALE) / BIOME_SCALE);
    const sample = (x: number, y: number) => hashWorld(config, x, y, BIOME_SALT) / 0xffffffff;
    const top = lerp(sample(cellX, cellY), sample(cellX + 1, cellY), fractionX);
    const bottom = lerp(sample(cellX, cellY + 1), sample(cellX + 1, cellY + 1), fractionX);

    return lerp(top, bottom, fractionY);
}

export function generateTerrainTile(config: WorldConfig, tileX: number, tileY: number): TerrainTile
{
    const spawnForest = SPAWN_FOREST_STRENGTH *
        Math.max(0, 1 - Math.hypot(tileX, tileY) / SPAWN_FOREST_RADIUS);
    const forestBlend = Math.max(biomeNoise(config, tileX, tileY), spawnForest);

    return {
        biome: forestBlend >= BIOME_THRESHOLD ? 'forest' : 'plain',
        forestBlend,
        surface: getSurface(config, tileX, tileY)
    };
}
