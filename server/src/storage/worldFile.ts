import { z } from 'zod';
import { CHUNK_SIZE, chunkKey, pixelToChunk } from '../../../shared/src/coordinates.ts';
import { NICKNAME_PATTERN } from '../../../shared/src/protocol.ts';
import { ITEM_IDS, ITEMS } from '../../../shared/src/items.ts';
import { GENERATOR_VERSION } from '../world/worldConfig.ts';

export const SAVE_VERSION = 2;
const coordinate = z.number().finite();
const integer = z.number().int().safe();
const surface = z.enum(['ground', 'water']);
const config = z.object({ seed: z.string().min(1), generatorVersion: z.number().int().refine((version): boolean => version === GENERATOR_VERSION, 'Unsupported generator version') }).strict();
const tile = z.object({
    biome: z.enum(['forest', 'plain']), forestBlend: z.number().min(0).max(1), surface
}).strict();
const object = z.object({
    id: z.string().min(1),
    type: z.enum(['tree', 'appleTree', 'rock', 'grass', 'redMushroom', 'purpleMushroom',
        'strawberryBush', 'bush', 'yellowFlower', 'pinkFlower', 'blueFlower', 'waterLily']),
    x: integer, y: integer, variant: z.number().int().min(0).max(1)
}).strict();
const animal = z.object({
    id: z.string().min(1), type: z.enum(['cow', 'chicken']),
    homeX: coordinate, homeY: coordinate, x: coordinate, y: coordinate,
    phase: z.enum(['idle', 'walk']), direction: z.number().int().min(0).max(3),
    remainingMs: z.number().finite(), decisionIndex: z.number().int().nonnegative()
}).strict();
const itemId = z.enum(ITEM_IDS as [typeof ITEM_IDS[number], ...typeof ITEM_IDS[number][]]);
const inventoryEntry = z.object({
    id: z.string().min(1), itemId, quantity: z.number().int().positive().safe()
}).strict().refine(entry => ITEMS[entry.itemId].stackable || entry.quantity === 1);
const groundItem = inventoryEntry.safeExtend({ x: coordinate, y: coordinate });
const chunk = z.object({
    x: integer, y: integer, config,
    tiles: z.array(z.array(tile).length(CHUNK_SIZE)).length(CHUNK_SIZE),
    surfaces: z.array(z.array(surface).length(CHUNK_SIZE + 2)).length(CHUNK_SIZE + 2),
    objects: z.array(object), animals: z.array(animal), items: z.array(groundItem)
}).strict();
const player = z.object({
    id: z.string().regex(NICKNAME_PATTERN), nickname: z.string().regex(NICKNAME_PATTERN),
    x: coordinate, y: coordinate, inventory: z.array(inventoryEntry)
}).strict();

function recordEntries(value: unknown): [string, unknown][] | null
{
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : null;
}

export const worldFileSchema = z.object({
    saveVersion: z.literal(SAVE_VERSION), worldId: z.string().uuid(), config,
    chunks: z.preprocess(recordEntries, z.array(z.tuple([z.string(), chunk]))).transform(entries => Object.fromEntries(entries)),
    players: z.preprocess(recordEntries, z.array(z.tuple([z.string(), player]))).transform(entries => Object.fromEntries(entries))
}).strict().superRefine((world, context) => {
    const ids = new Set<string>();
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    for (const [key, value] of Object.entries(world.chunks))
    {
        if (key !== chunkKey(value.x, value.y) || value.config.seed !== world.config.seed)
        {
            invalid('Chunk identity/configuration does not match the world');
        }
        for (let y = 0; y < CHUNK_SIZE; y++)
        {
            for (let x = 0; x < CHUNK_SIZE; x++)
            {
                if (value.tiles[y][x].surface !== value.surfaces[y + 1][x + 1])
                {
                    invalid('Chunk surface border does not match terrain');
                }
            }
        }
        for (const entity of [...value.objects, ...value.animals, ...value.items])
        {
            if (ids.has(entity.id)) invalid('Duplicate entity identity');
            ids.add(entity.id);
        }
        for (const item of value.items)
        {
            if (chunkKey(pixelToChunk(item.x), pixelToChunk(item.y)) !== key) invalid('Ground item is outside its chunk');
        }
    }
    for (const [key, value] of Object.entries(world.players))
    {
        if (key !== value.id || key !== value.nickname.toLowerCase()) invalid('Invalid player identity');
        const center = chunkKey(pixelToChunk(value.x), pixelToChunk(value.y));
        if (!Object.hasOwn(world.chunks, center)) invalid('Player chunk is missing');
        const stacked = new Set<string>();
        for (const entry of value.inventory)
        {
            if (ids.has(entry.id)) invalid('Duplicate entity identity');
            ids.add(entry.id);
            if (ITEMS[entry.itemId].stackable)
            {
                if (stacked.has(entry.itemId)) invalid('Duplicate inventory stack');
                stacked.add(entry.itemId);
            }
        }
    }
});

export type WorldFile = z.infer<typeof worldFileSchema>;
