import { generateTerrainTile, type TerrainTile, type WorldConfig } from './terrain.ts';
import { generateChunkObjects, type WorldObject } from './worldObjects.ts';

export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PIXEL_SIZE = TILE_SIZE * CHUNK_SIZE;

export interface ChunkPosition {
    x: number;
    y: number;
}

export interface TileAddress {
    chunk: ChunkPosition;
    local: ChunkPosition;
}

export interface ChunkData extends ChunkPosition {
    config: WorldConfig;
    tiles: TerrainTile[][];
    objects: WorldObject[];
}

export function pixelToTile(pixel: number): number
{
    return Math.floor(pixel / TILE_SIZE);
}

export function tileToPixel(tile: number): number
{
    return tile * TILE_SIZE;
}

export function tileToChunk(tile: number): number
{
    return Math.floor(tile / CHUNK_SIZE);
}

export function pixelToChunk(pixel: number): number
{
    return tileToChunk(pixelToTile(pixel));
}

export function chunkToTile(chunk: number): number
{
    return chunk * CHUNK_SIZE;
}

export function tileToAddress(tileX: number, tileY: number): TileAddress
{
    const chunkX = tileToChunk(tileX);
    const chunkY = tileToChunk(tileY);

    return {
        chunk: { x: chunkX, y: chunkY },
        local: { x: tileX - chunkToTile(chunkX), y: tileY - chunkToTile(chunkY) }
    };
}

export function addressToTile(address: TileAddress): ChunkPosition
{
    return {
        x: chunkToTile(address.chunk.x) + address.local.x,
        y: chunkToTile(address.chunk.y) + address.local.y
    };
}

export function chunkKey(x: number, y: number): string
{
    return `${x},${y}`;
}

export function generateChunk(config: WorldConfig, chunkX: number, chunkY: number): ChunkData
{
    const tiles: TerrainTile[][] = [];
    const originX = chunkToTile(chunkX);
    const originY = chunkToTile(chunkY);

    for (let y = 0; y < CHUNK_SIZE; y++)
    {
        const row: TerrainTile[] = [];

        for (let x = 0; x < CHUNK_SIZE; x++)
        {
            row.push(generateTerrainTile(config, originX + x, originY + y));
        }

        tiles.push(row);
    }

    return { x: chunkX, y: chunkY, config: { ...config }, tiles, objects: generateChunkObjects(config, chunkX, chunkY) };
}
