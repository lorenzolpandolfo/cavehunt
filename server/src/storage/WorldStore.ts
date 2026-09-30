import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type FileHandle } from 'node:fs/promises';
import { CHUNK_SIZE, TILE_SIZE, chunkKey, pixelToChunk } from '../../../shared/src/coordinates.ts';
import { type AnimalMotion, type AnimalUpdate, type ChunkSnapshot, type GroundItem, type InventoryEntry, type ItemUpdate, type PlayerData, PROTOCOL_VERSION, type WorldMetadata } from '../../../shared/src/protocol.ts';
import { ITEM_IDS, ITEMS } from '../../../shared/src/items.ts';
import { generateChunk } from '../world/chunk.ts';
import { advanceAnimal, generateChunkAnimals } from '../world/animals.ts';
import { getSurface } from '../world/surface.ts';
import { generateChunkObjects } from '../world/worldObjects.ts';
import { WORLD_CONFIG } from '../world/worldConfig.ts';
import { SAVE_VERSION, worldFileSchema, type WorldFile } from './worldFile.ts';

export type SaveWorld = (path: string, data: WorldFile) => Promise<void>;
export interface ItemTransfer { inventory: InventoryEntry[]; update: ItemUpdate }
const PICKUP_RADIUS = 20;

export async function writeWorldAtomically(path: string, data: WorldFile): Promise<void>
{
    const temporary = `${path}.${randomUUID()}.tmp`;
    try
    {
        const file = await open(temporary, 'wx', 0o600);
        try
        {
            await file.writeFile(JSON.stringify(data));
            await file.sync();
        }
        finally
        {
            await file.close();
        }
        await rename(temporary, path);
    }
    finally
    {
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
        });
    }
}

export class WorldStore
{
    private queue: Promise<unknown> = Promise.resolve();
    private closing = false;
    private revision = 0;
    private dirty = false;
    private closeResult?: Promise<void>;
    private constructor(
        private readonly path: string,
        private data: WorldFile,
        private readonly lock: FileHandle,
        private readonly save: SaveWorld
    ) {}

    static async open(path: string, save: SaveWorld = writeWorldAtomically): Promise<WorldStore>
    {
        await mkdir(dirname(path), { recursive: true });
        const lock = await open(`${path}.lock`, 'wx', 0o600);
        try
        {
            await lock.writeFile(JSON.stringify({ pid: process.pid }));
            let data: WorldFile;
            let raw: string;
            try
            {
                raw = await readFile(path, 'utf8');
            }
            catch (error)
            {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                data = { saveVersion: SAVE_VERSION, worldId: randomUUID(), config: { ...WORLD_CONFIG }, chunks: {}, players: {} };
                await save(path, data);
                return new WorldStore(path, data, lock, save);
            }
            data = worldFileSchema.parse(JSON.parse(raw));
            return new WorldStore(path, data, lock, save);
        }
        catch (error)
        {
            await lock.close();
            await unlink(`${path}.lock`);
            throw error;
        }
    }

    get metadata(): WorldMetadata
    {
        return { ...this.data.config, worldId: this.data.worldId, protocolVersion: PROTOCOL_VERSION };
    }

    preparePlayer(id: string, nickname: string, occupied: () => readonly Pick<PlayerData, 'x' | 'y'>[]): Promise<PlayerData>
    {
        return this.enqueue(async () => {
            const saved = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
            const player = saved ?? { id, nickname, ...this.findSpawn(occupied()), inventory: [] };
            const chunks = { ...this.data.chunks };
            for (const position of this.window(player))
            {
                const key = chunkKey(position.x, position.y);
                if (!Object.hasOwn(chunks, key)) chunks[key] = this.generate(position.x, position.y);
            }
            if (!saved && Object.keys(this.data.players).length === 0)
            {
                const offsets = [{ x: 32, y: 0 }, { x: 0, y: 32 }, { x: -32, y: 0 }];
                for (const [index, itemId] of ITEM_IDS.entries())
                {
                    const x = player.x + offsets[index].x;
                    const y = player.y + offsets[index].y;
                    const key = chunkKey(pixelToChunk(x), pixelToChunk(y));
                    chunks[key] = { ...chunks[key], items: [...chunks[key].items,
                        { id: randomUUID(), itemId, quantity: 1, x, y }] };
                }
            }
            const next = { ...this.data, chunks, players: { ...this.data.players, [id]: player } };
            const revision = this.revision;
            await this.save(this.path, next);
            this.data = { ...this.data, chunks, players: { ...this.data.players, [id]: player } };
            if (this.revision === revision) this.dirty = false;
            return { ...player };
        });
    }

    chunksFor(player: Pick<PlayerData, 'x' | 'y'>): ChunkSnapshot[]
    {
        return this.window(player).map(({ x, y }) => this.data.chunks[chunkKey(x, y)]);
    }

    advanceAnimals(activeChunkKeys: ReadonlySet<string>, deltaMs: number): Set<string>
    {
        if (this.closing) throw new Error('World is shutting down');
        const changed = new Set<string>();
        let advanced = false;
        for (const key of activeChunkKeys)
        {
            const chunk = Object.hasOwn(this.data.chunks, key) ? this.data.chunks[key] : undefined;
            if (!chunk) continue;
            for (const animal of chunk.animals)
            {
                const { x, y, phase, direction } = animal;
                advanceAnimal(this.data.config, animal, deltaMs);
                advanced = true;
                if (animal.x !== x || animal.y !== y || animal.phase !== phase || animal.direction !== direction)
                {
                    changed.add(key);
                }
            }
        }
        if (advanced)
        {
            this.revision++;
            this.dirty = true;
        }
        return changed;
    }

    animalUpdate(key: string): AnimalUpdate | undefined
    {
        const chunk = Object.hasOwn(this.data.chunks, key) ? this.data.chunks[key] : undefined;
        if (!chunk) return undefined;
        const animals: AnimalMotion[] = chunk.animals.map(({ id, x, y, phase, direction }) =>
            ({ id, x, y, phase, direction }));
        return { x: chunk.x, y: chunk.y, animals };
    }

    hasWindow(player: Pick<PlayerData, 'x' | 'y'>): boolean
    {
        return this.window(player).every(({ x, y }) => Object.hasOwn(this.data.chunks, chunkKey(x, y)));
    }

    ensureWindow(player: Pick<PlayerData, 'x' | 'y'>): Promise<void>
    {
        return this.enqueue(async () => {
            if (this.hasWindow(player)) return;
            const chunks = { ...this.data.chunks };
            for (const { x, y } of this.window(player))
            {
                const key = chunkKey(x, y);
                if (!Object.hasOwn(chunks, key)) chunks[key] = this.generate(x, y);
            }
            const revision = this.revision;
            await this.save(this.path, { ...this.data, chunks });
            this.data = { ...this.data, chunks };
            if (this.revision === revision) this.dirty = false;
        });
    }

    updatePosition(id: string, x: number, y: number): void
    {
        const current = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
        if (!current) throw new Error('Unknown character');
        if (this.closing) throw new Error('World is shutting down');
        if (current.x === x && current.y === y) return;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !this.hasWindow({ x, y })) throw new Error('Invalid character position');
        this.data = { ...this.data, players: { ...this.data.players, [id]: { ...current, x, y } } };
        this.revision++;
        this.dirty = true;
    }

    inventoryFor(id: string): InventoryEntry[]
    {
        const player = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
        if (!player) throw new Error('Unknown character');
        return player.inventory.map(entry => ({ ...entry }));
    }

    collectNearby(id: string): Promise<ItemTransfer | undefined>
    {
        return this.enqueue(async () => {
            const player = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
            if (!player) return undefined;
            for (const chunk of this.chunksFor(player))
            {
                const item = chunk.items.find(candidate => !(candidate.droppedBy === id && candidate.ownerMustLeave) &&
                    Math.hypot(candidate.x - player.x, candidate.y - player.y) <= PICKUP_RADIUS);
                if (!item) continue;
                const inventory = player.inventory.map(entry => ({ ...entry }));
                const stack = ITEMS[item.itemId].stackable ? inventory.find(entry => entry.itemId === item.itemId) : undefined;
                if (stack)
                {
                    if (!Number.isSafeInteger(stack.quantity + item.quantity)) return undefined;
                    stack.quantity += item.quantity;
                }
                else inventory.push({ id: item.id, itemId: item.itemId, quantity: item.quantity });
                return this.commitItems(id, chunk, chunk.items.filter(candidate => candidate.id !== item.id), inventory);
            }
            return undefined;
        });
    }

    releaseOwnDrops(id: string): void
    {
        const player = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
        if (!player) return;
        for (const chunk of this.chunksFor(player))
        {
            if (!chunk.items.some(item => item.droppedBy === id && item.ownerMustLeave &&
                Math.hypot(item.x - player.x, item.y - player.y) > PICKUP_RADIUS)) continue;
            const items = chunk.items.map(item => item.droppedBy === id && item.ownerMustLeave &&
                Math.hypot(item.x - player.x, item.y - player.y) > PICKUP_RADIUS
                ? { ...item, ownerMustLeave: false } : item);
            const key = chunkKey(chunk.x, chunk.y);
            this.data = { ...this.data, chunks: { ...this.data.chunks, [key]: { ...chunk, items } } };
            this.revision++;
            this.dirty = true;
        }
    }

    dropItem(id: string, entryId: string): Promise<ItemTransfer | undefined>
    {
        return this.enqueue(async () => {
            const player = Object.hasOwn(this.data.players, id) ? this.data.players[id] : undefined;
            if (!player) return undefined;
            const entry = player.inventory.find(candidate => candidate.id === entryId);
            if (!entry) return undefined;
            const inventory = player.inventory.map(candidate => ({ ...candidate }));
            const index = inventory.findIndex(candidate => candidate.id === entryId);
            if (entry.quantity === 1) inventory.splice(index, 1);
            else inventory[index].quantity--;
            const key = chunkKey(pixelToChunk(player.x), pixelToChunk(player.y));
            const chunk = this.data.chunks[key];
            const ground: GroundItem = {
                id: entry.quantity === 1 ? entry.id : randomUUID(), itemId: entry.itemId,
                quantity: 1, x: player.x, y: player.y, droppedBy: id, ownerMustLeave: true
            };
            return this.commitItems(id, chunk, [...chunk.items, ground], inventory);
        });
    }

    private async commitItems(id: string, chunk: ChunkSnapshot, items: GroundItem[], inventory: InventoryEntry[]): Promise<ItemTransfer>
    {
        const key = chunkKey(chunk.x, chunk.y);
        const nextChunk = { ...chunk, items };
        const nextPlayer = { ...this.data.players[id], inventory };
        const next = { ...this.data, chunks: { ...this.data.chunks, [key]: nextChunk },
            players: { ...this.data.players, [id]: nextPlayer } };
        const revision = this.revision;
        await this.save(this.path, next);
        this.data = { ...this.data, chunks: { ...this.data.chunks, [key]: nextChunk },
            players: { ...this.data.players, [id]: { ...this.data.players[id], inventory } } };
        if (this.revision === revision) this.dirty = false;
        return { inventory: inventory.map(entry => ({ ...entry })),
            update: { x: chunk.x, y: chunk.y, items: items.map(item => ({ ...item })) } };
    }

    flush(force = false): Promise<void>
    {
        return this.enqueue(() => this.saveCurrent(force));
    }

    private async saveCurrent(force = false): Promise<void>
    {
        if (!this.dirty && !force) return;
        const revision = this.revision;
        await this.save(this.path, this.data);
        if (this.revision === revision) this.dirty = false;
    }

    close(): Promise<void>
    {
        if (this.closeResult) return this.closeResult;
        this.closing = true;
        this.closeResult = this.queue.then(async () => {
            try
            {
                await this.saveCurrent();
            }
            finally
            {
                await this.lock.close();
                await unlink(`${this.path}.lock`);
            }
        });
        return this.closeResult;
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T>
    {
        if (this.closing) return Promise.reject(new Error('World is shutting down'));
        const result = this.queue.then(operation);
        this.queue = result.catch(() => undefined);
        return result;
    }

    private window(player: Pick<PlayerData, 'x' | 'y'>): { x: number; y: number }[]
    {
        const x = pixelToChunk(player.x);
        const y = pixelToChunk(player.y);
        return [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ x: x + dx, y: y + dy })));
    }

    private generate(x: number, y: number): ChunkSnapshot
    {
        const config = this.data.config;
        const surfaces = Array.from({ length: CHUNK_SIZE + 2 }, (_, row) =>
            Array.from({ length: CHUNK_SIZE + 2 }, (_, column) =>
                getSurface(config, x * CHUNK_SIZE + column - 1, y * CHUNK_SIZE + row - 1)));
        return { ...generateChunk(config, x, y), surfaces, animals: generateChunkAnimals(config, x, y), items: [] };
    }

    private findSpawn(occupied: readonly Pick<PlayerData, 'x' | 'y'>[]): { x: number; y: number }
    {
        const objects = new Map<string, ReturnType<typeof generateChunkObjects>>();
        const spacing = TILE_SIZE * 2;
        for (let radius = 0; radius <= 64; radius++)
        {
            for (let row = -radius; row <= radius; row++)
            {
                for (let column = -radius; column <= radius; column++)
                {
                    if (Math.max(Math.abs(row), Math.abs(column)) !== radius) continue;
                    const x = TILE_SIZE / 2 + column * spacing;
                    const y = TILE_SIZE / 2 + row * spacing;
                    if (occupied.some(player => Math.hypot(player.x - x, player.y - y) < spacing)) continue;
                    let blocked = false;
                    for (let cy = pixelToChunk(y - spacing); cy <= pixelToChunk(y + spacing); cy++)
                    {
                        for (let cx = pixelToChunk(x - spacing); cx <= pixelToChunk(x + spacing); cx++)
                        {
                            const key = chunkKey(cx, cy);
                            let nearby = objects.get(key);
                            if (!nearby)
                            {
                                nearby = generateChunkObjects(this.data.config, cx, cy);
                                objects.set(key, nearby);
                            }
                            if (nearby.some(object => Math.abs((object.x + 0.5) * TILE_SIZE - x) < spacing &&
                                Math.abs((object.y + 1) * TILE_SIZE - y) < spacing)) blocked = true;
                        }
                    }
                    if (!blocked) return { x, y };
                }
            }
        }
        throw new Error('No free spawn position');
    }
}
