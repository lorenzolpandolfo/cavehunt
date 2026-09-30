import { generateTerrainTile, type Biome, type WorldConfig } from './terrain.ts';
import { hashWorld } from './worldHash.ts';

const OBJECT_CELL_SIZE = 4;
const CELLS_PER_CHUNK = 8;
const SPAWN_CLEAR_RADIUS = 4;
const TYPE_SALT = 0x7a514e27;
const X_SALT = 0x493bdab5;
const Y_SALT = 0xc15a66d3;
const VARIANT_SALT = 0x1f83d9ab;

export type WorldObjectType = 'tree' | 'rock' | 'smallRock' | 'strawberryBush' | 'plainBush' | 'mediumBush' | 'smallBush' | 'flower' | 'plant' | 'mushroom' | 'waterLily';

export interface WorldObject {
    id: string;
    type: WorldObjectType;
    x: number;
    y: number;
    variant: number;
}

function chooseType(value: number, biome: Biome): WorldObjectType | undefined
{
    if (biome === 'forest')
    {
        if (value < 22) return 'tree';
        if (value < 30) return 'rock';
        if (value < 37) return 'strawberryBush';
        if (value < 44) return 'plainBush';
        if (value < 58) return 'mediumBush';
        if (value < 70) return 'smallBush';
        if (value < 76) return 'smallRock';
        if (value < 86) return 'flower';
        if (value < 95) return 'plant';
        return 'mushroom';
    }

    if (value < 4) return 'tree';
    if (value < 11) return 'rock';
    if (value < 13) return 'strawberryBush';
    if (value < 16) return 'plainBush';
    if (value < 23) return 'mediumBush';
    if (value < 33) return 'smallBush';
    if (value < 41) return 'smallRock';
    if (value < 58) return 'flower';
    if (value < 70) return 'plant';
    if (value < 74) return 'mushroom';
    return undefined;
}

export function generateWorldObject(config: WorldConfig, cellX: number, cellY: number): WorldObject | undefined
{
    const x = cellX * OBJECT_CELL_SIZE + 1 + hashWorld(config, cellX, cellY, X_SALT) % 2;
    const y = cellY * OBJECT_CELL_SIZE + 1 + hashWorld(config, cellX, cellY, Y_SALT) % 2;

    if (Math.abs(x) <= SPAWN_CLEAR_RADIUS && Math.abs(y) <= SPAWN_CLEAR_RADIUS)
    {
        return undefined;
    }

    const terrain = generateTerrainTile(config, x, y);

    const value = hashWorld(config, cellX, cellY, TYPE_SALT) % 100;
    const type = terrain.surface === 'water'
        ? value < 25 ? 'waterLily' : undefined
        : chooseType(value, terrain.biome);

    if (!type)
    {
        return undefined;
    }

    return {
        id: `${type}:${x},${y}`,
        type,
        x,
        y,
        variant: hashWorld(config, cellX, cellY, VARIANT_SALT) % 2
    };
}

export function generateChunkObjects(config: WorldConfig, chunkX: number, chunkY: number): WorldObject[]
{
    const objects: WorldObject[] = [];
    const startCellX = chunkX * CELLS_PER_CHUNK;
    const startCellY = chunkY * CELLS_PER_CHUNK;

    for (let cellY = startCellY; cellY < startCellY + CELLS_PER_CHUNK; cellY++)
    {
        for (let cellX = startCellX; cellX < startCellX + CELLS_PER_CHUNK; cellX++)
        {
            const object = generateWorldObject(config, cellX, cellY);

            if (object)
            {
                objects.push(object);
            }
        }
    }

    return objects;
}
