import { chunkKey, generateChunk, pixelToChunk, type ChunkData } from './chunk.ts';
import { type WorldConfig } from './terrain.ts';

const LOAD_RADIUS = 1;

export class ChunkManager<T>
{
    private readonly loaded = new Map<string, T>();
    private readonly config: WorldConfig;
    private readonly createChunk: (chunk: ChunkData) => T;
    private readonly destroyChunk: (chunk: T) => void;
    private centerKey?: string;

    constructor(
        config: WorldConfig,
        createChunk: (chunk: ChunkData) => T,
        destroyChunk: (chunk: T) => void
    )
    {
        this.config = config;
        this.createChunk = createChunk;
        this.destroyChunk = destroyChunk;
    }

    update(pixelX: number, pixelY: number): void
    {
        const centerX = pixelToChunk(pixelX);
        const centerY = pixelToChunk(pixelY);
        const nextCenterKey = chunkKey(centerX, centerY);

        if (this.centerKey === nextCenterKey)
        {
            return;
        }

        const needed = new Set<string>();

        for (let y = centerY - LOAD_RADIUS; y <= centerY + LOAD_RADIUS; y++)
        {
            for (let x = centerX - LOAD_RADIUS; x <= centerX + LOAD_RADIUS; x++)
            {
                const key = chunkKey(x, y);
                needed.add(key);

                if (!this.loaded.has(key))
                {
                    this.loaded.set(key, this.createChunk(generateChunk(this.config, x, y)));
                }
            }
        }

        for (const [key, chunk] of this.loaded)
        {
            if (!needed.has(key))
            {
                this.destroyChunk(chunk);
                this.loaded.delete(key);
            }
        }

        this.centerKey = nextCenterKey;
    }

    getLoadedKeys(): string[]
    {
        return [...this.loaded.keys()];
    }

    destroy(): void
    {
        for (const chunk of this.loaded.values())
        {
            this.destroyChunk(chunk);
        }

        this.loaded.clear();
        this.centerKey = undefined;
    }
}
