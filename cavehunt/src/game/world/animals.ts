import { CHUNK_SIZE, TILE_SIZE, chunkKey, pixelToTile } from './chunk.ts';
import { getSurface } from './surface.ts';
import { generateTerrainTile } from './terrain.ts';
import { hashWorld } from './worldHash.ts';
import { type WorldConfig } from './worldConfig.ts';

const SPAWN_MARGIN = 6;
const MAX_SPAWN_ATTEMPTS = 16;
const GROUP_SPACING = 2;
const ROAM_RADIUS = 2 * TILE_SIZE;
const MAX_STEP_MS = 100;
const COW_SPEED = 18;
const CHICKEN_SPEED = 28;
const SPAWN_X_SALT = 0x4187c82a;
const SPAWN_Y_SALT = 0x2ad79b34;
const SPAWN_CHANCE_SALT = 0x64e791ac;
const GROUP_SIZE_SALT = 0x538dd16e;
const IDLE_SALT = 0x45cb178d;
const WALK_SALT = 0x75138bca;
const DIRECTION_SALT = 0x19d4ac67;

export type AnimalType = 'cow' | 'chicken';
export type AnimalPhase = 'idle' | 'walk';

export interface AnimalState {
    id: string;
    type: AnimalType;
    homeX: number;
    homeY: number;
    x: number;
    y: number;
    phase: AnimalPhase;
    direction: number;
    remainingMs: number;
    decisionIndex: number;
}

interface AnimalRules {
    halfWidth: number;
    halfHeight: number;
    speed: number;
    plainChance: number;
    forestChance: number;
    smallGroupSize: number;
    salt: number;
}

const ANIMAL_RULES: Record<AnimalType, AnimalRules> = {
    cow: { halfWidth: 12, halfHeight: 4, speed: COW_SPEED, plainChance: 70, forestChance: 30, smallGroupSize: 3, salt: 0x241b58e3 },
    chicken: { halfWidth: 5, halfHeight: 3, speed: CHICKEN_SPEED, plainChance: 80, forestChance: 40, smallGroupSize: 2, salt: 0x375ad6c1 }
};

const GROUP_OFFSETS = [
    { x: 0, y: 0 },
    { x: GROUP_SPACING, y: 0 },
    { x: -GROUP_SPACING, y: 0 },
    { x: 0, y: GROUP_SPACING },
    { x: 0, y: -GROUP_SPACING }
];

const DIRECTIONS = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
];

function animalHash(config: WorldConfig, state: AnimalState, salt: number): number
{
    return hashWorld(config, pixelToTile(state.homeX), pixelToTile(state.homeY),
        salt ^ ANIMAL_RULES[state.type].salt ^ Math.imul(state.decisionIndex, 0x9e3779b1));
}

export function hasGroundFootprint(config: WorldConfig, type: AnimalType, x: number, y: number): boolean
{
    const { halfWidth, halfHeight } = ANIMAL_RULES[type];
    const minTileX = pixelToTile(x - halfWidth);
    const maxTileX = pixelToTile(x + halfWidth);
    const minTileY = pixelToTile(y - halfHeight);
    const maxTileY = pixelToTile(y + halfHeight);

    for (let tileY = minTileY; tileY <= maxTileY; tileY++)
    {
        for (let tileX = minTileX; tileX <= maxTileX; tileX++)
        {
            if (getSurface(config, tileX, tileY) !== 'ground')
            {
                return false;
            }
        }
    }

    return true;
}

export function generateChunkAnimals(config: WorldConfig, chunkX: number, chunkY: number): AnimalState[]
{
    const animals: AnimalState[] = [];
    const availableTiles = CHUNK_SIZE - SPAWN_MARGIN * 2;

    for (const type of ['cow', 'chicken'] as const)
    {
        const rules = ANIMAL_RULES[type];
        const groupSize = hashWorld(config, chunkX, chunkY, rules.salt ^ GROUP_SIZE_SALT) % 2 === 0
            ? rules.smallGroupSize : GROUP_OFFSETS.length;
        let centerX = 0;
        let centerY = 0;
        let found = false;

        for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++)
        {
            const tileX = chunkX * CHUNK_SIZE + SPAWN_MARGIN +
                hashWorld(config, chunkX, chunkY, rules.salt ^ SPAWN_X_SALT ^ attempt) % availableTiles;
            const tileY = chunkY * CHUNK_SIZE + SPAWN_MARGIN +
                hashWorld(config, chunkX, chunkY, rules.salt ^ SPAWN_Y_SALT ^ attempt) % availableTiles;
            const x = (tileX + 0.5) * TILE_SIZE;
            const y = (tileY + 0.75) * TILE_SIZE;

            if (GROUP_OFFSETS.slice(0, groupSize).every(offset =>
                hasGroundFootprint(config, type, x + offset.x * TILE_SIZE, y + offset.y * TILE_SIZE)))
            {
                centerX = tileX;
                centerY = tileY;
                found = true;
                break;
            }
        }

        if (!found)
        {
            continue;
        }

        const terrain = generateTerrainTile(config, centerX, centerY);
        const chance = terrain.biome === 'plain' ? rules.plainChance : rules.forestChance;
        const roll = hashWorld(config, chunkX, chunkY, rules.salt ^ SPAWN_CHANCE_SALT) % 100;

        if (roll >= chance)
        {
            continue;
        }

        for (const [index, offset] of GROUP_OFFSETS.slice(0, groupSize).entries())
        {
            const tileX = centerX + offset.x;
            const tileY = centerY + offset.y;
            const x = (tileX + 0.5) * TILE_SIZE;
            const y = (tileY + 0.75) * TILE_SIZE;

            animals.push({
                id: `${type}:${chunkKey(chunkX, chunkY)}:${index}`,
                type,
                homeX: x,
                homeY: y,
                x,
                y,
                phase: 'idle',
                direction: 0,
                remainingMs: 800 + hashWorld(config, tileX, tileY, rules.salt ^ IDLE_SALT) % 1600,
                decisionIndex: 0
            });
        }
    }

    return animals;
}

function beginNextPhase(config: WorldConfig, animal: AnimalState): void
{
    if (animal.phase === 'walk')
    {
        animal.phase = 'idle';
        animal.remainingMs = 800 + animalHash(config, animal, IDLE_SALT) % 1600;
        return;
    }

    animal.decisionIndex++;
    animal.phase = 'walk';
    animal.direction = animalHash(config, animal, DIRECTION_SALT) % DIRECTIONS.length;
    animal.remainingMs = 600 + animalHash(config, animal, WALK_SALT) % 1200;
}

export function advanceAnimal(config: WorldConfig, animal: AnimalState, deltaMs: number): void
{
    let remaining = Math.max(0, deltaMs);

    while (remaining > 0)
    {
        if (animal.remainingMs <= 0)
        {
            beginNextPhase(config, animal);
        }

        const stepMs = Math.min(remaining, animal.remainingMs, MAX_STEP_MS);

        if (animal.phase === 'walk')
        {
            const direction = DIRECTIONS[animal.direction];
            const distance = ANIMAL_RULES[animal.type].speed * stepMs / 1000;
            const nextX = animal.x + direction.x * distance;
            const nextY = animal.y + direction.y * distance;

            if (Math.hypot(nextX - animal.homeX, nextY - animal.homeY) > ROAM_RADIUS ||
                !hasGroundFootprint(config, animal.type, nextX, nextY))
            {
                animal.phase = 'idle';
                animal.remainingMs = 800 + animalHash(config, animal, IDLE_SALT) % 1600;
            }
            else
            {
                animal.x = nextX;
                animal.y = nextY;
            }
        }

        animal.remainingMs -= stepMs;
        remaining -= stepMs;
    }
}

export class AnimalPopulation
{
    private readonly saved = new Map<string, AnimalState[]>();
    private readonly active = new Map<string, AnimalState[]>();
    private readonly config: WorldConfig;

    constructor(config: WorldConfig)
    {
        this.config = config;
    }

    load(chunkX: number, chunkY: number): AnimalState[]
    {
        const key = chunkKey(chunkX, chunkY);
        let animals = this.saved.get(key);

        if (!animals)
        {
            animals = generateChunkAnimals(this.config, chunkX, chunkY);
            this.saved.set(key, animals);
        }

        this.active.set(key, animals);
        return animals;
    }

    unload(chunkX: number, chunkY: number): void
    {
        this.active.delete(chunkKey(chunkX, chunkY));
    }

    update(deltaMs: number): void
    {
        for (const animals of this.active.values())
        {
            for (const animal of animals)
            {
                advanceAnimal(this.config, animal, deltaMs);
            }
        }
    }

    destroy(): void
    {
        this.active.clear();
        this.saved.clear();
    }
}
