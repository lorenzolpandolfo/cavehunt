import { type Direction } from './movement.ts';

export const PROTOCOL_VERSION = 5;
export const ROOM_NAME = 'world';
export const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

export interface WorldConfig {
    seed: string;
    generatorVersion: number;
}

export type Surface = 'ground' | 'water';
export type Biome = 'forest' | 'plain';

export interface TerrainTile {
    biome: Biome;
    forestBlend: number;
    surface: Surface;
}

export type WorldObjectType = 'tree' | 'appleTree' | 'rock' | 'grass' | 'redMushroom' |
    'purpleMushroom' | 'strawberryBush' | 'bush' | 'yellowFlower' | 'pinkFlower' | 'blueFlower' | 'waterLily';

export interface WorldObject {
    id: string;
    type: WorldObjectType;
    x: number;
    y: number;
    variant: number;
}

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

export interface ChunkData {
    x: number;
    y: number;
    config: WorldConfig;
    tiles: TerrainTile[][];
    objects: WorldObject[];
}

export interface ChunkSnapshot extends ChunkData {
    surfaces: Surface[][];
    animals: AnimalState[];
}

export interface PlayerData {
    id: string;
    nickname: string;
    x: number;
    y: number;
}

export interface WorldMetadata extends WorldConfig {
    worldId: string;
    protocolVersion: number;
}

export interface InitialWorld {
    metadata: WorldMetadata;
    playerId: string;
    chunks: ChunkSnapshot[];
}

export interface JoinOptions {
    nickname: string;
    protocolVersion: number;
}

export interface PlayerSnapshot extends PlayerData {
    direction: Direction;
    moving: boolean;
    lastProcessedSequence: number;
}

export interface PlayerCorrection {
    x: number;
    y: number;
    direction: Direction;
    moving: boolean;
    epoch: number;
}

export interface ChunkWindow {
    chunks: ChunkSnapshot[];
}

export type AnimalMotion = Pick<AnimalState, 'id' | 'x' | 'y' | 'phase' | 'direction'>;

export interface AnimalUpdate {
    x: number;
    y: number;
    animals: AnimalMotion[];
}
