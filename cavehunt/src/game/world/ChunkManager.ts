import { chunkKey } from '../../../../shared/src/coordinates.ts';
import { type ChunkSnapshot } from '../../../../shared/src/protocol.ts';

export class ChunkManager<T>
{
    private readonly loaded = new Map<string, T>();
    private readonly createChunk: (chunk: ChunkSnapshot) => T;
    private readonly destroyChunk: (chunk: T) => void;

    constructor(createChunk: (chunk: ChunkSnapshot) => T, destroyChunk: (chunk: T) => void)
    {
        this.createChunk = createChunk;
        this.destroyChunk = destroyChunk;
    }

    apply(chunks: readonly ChunkSnapshot[]): void
    {
        const needed = new Set(chunks.map(chunk => chunkKey(chunk.x, chunk.y)));
        for (const [key, chunk] of this.loaded)
        {
            if (!needed.has(key))
            {
                this.destroyChunk(chunk);
                this.loaded.delete(key);
            }
        }
        for (const chunk of chunks)
        {
            const key = chunkKey(chunk.x, chunk.y);
            if (!this.loaded.has(key)) this.loaded.set(key, this.createChunk(chunk));
        }
    }

    getLoadedKeys(): string[]
    {
        return [...this.loaded.keys()];
    }

    destroy(): void
    {
        for (const chunk of this.loaded.values()) this.destroyChunk(chunk);
        this.loaded.clear();
    }
}
