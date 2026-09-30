import { CHUNK_SIZE, chunkToTile } from '../../../shared/src/coordinates.ts';
export * from '../../../shared/src/coordinates.ts';
import { type ChunkData } from '../../../shared/src/protocol.ts';
export type { ChunkData } from '../../../shared/src/protocol.ts';
import { generateTerrainTile, type TerrainTile, type WorldConfig } from './terrain.ts';
import { generateChunkObjects } from './worldObjects.ts';

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
