import { hashWorld } from './worldHash.ts';
import { type WorldConfig } from './worldConfig.ts';

const RIVER_SPACING = 48;
const RIVER_ORIGIN = 24;
const SWAY_SCALE = 64;
const MAX_SWAY = 14;
const SWAY_SALT = 0x81f82b51;
const WIDTH_SALT = 0x9af2de18;

export interface RiverSection {
    minX: number;
    maxX: number;
}

function smoothStep(value: number): number
{
    return value * value * (3 - 2 * value);
}

function swayAt(config: WorldConfig, riverIndex: number, segment: number): number
{
    return hashWorld(config, riverIndex, segment, SWAY_SALT) / 0xffffffff * 2 - 1;
}

export function getRiverSection(config: WorldConfig, riverIndex: number, tileY: number): RiverSection
{
    const segment = Math.floor(tileY / SWAY_SCALE);
    const fraction = smoothStep((tileY - segment * SWAY_SCALE) / SWAY_SCALE);
    const sway = swayAt(config, riverIndex, segment) * (1 - fraction) +
        swayAt(config, riverIndex, segment + 1) * fraction;
    const centerX = riverIndex * RIVER_SPACING + RIVER_ORIGIN + Math.round(sway * MAX_SWAY);
    const width = 3 + hashWorld(config, riverIndex, 0, WIDTH_SALT) % 3;
    const minX = centerX - Math.floor((width - 1) / 2);
    return { minX, maxX: minX + width - 1 };
}

function nearbyRiverIndices(tileX: number): [number, number]
{
    const left = Math.floor((tileX - RIVER_ORIGIN) / RIVER_SPACING);
    return [left, left + 1];
}

export function getRiverSurface(config: WorldConfig, tileX: number, tileY: number): 'ground' | 'water'
{
    for (const index of nearbyRiverIndices(tileX))
    {
        const section = getRiverSection(config, index, tileY);

        if (tileX >= section.minX && tileX <= section.maxX)
        {
            return 'water';
        }
    }

    return 'ground';
}
