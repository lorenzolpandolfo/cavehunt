import { isLakeTile } from './lake.ts';
import { getRiverSurface } from './river.ts';
import { type WorldConfig } from './worldConfig.ts';

export type Surface = 'ground' | 'water';

export function getSurface(config: WorldConfig, tileX: number, tileY: number): Surface
{
    return getRiverSurface(config, tileX, tileY) === 'water' || isLakeTile(config, tileX, tileY)
        ? 'water' : 'ground';
}
