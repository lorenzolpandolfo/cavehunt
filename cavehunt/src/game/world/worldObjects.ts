import {
  generateTerrainTile,
  type Biome,
  type WorldConfig,
} from "./terrain.ts";
import { hashWorld } from "./worldHash.ts";

const OBJECT_CELL_SIZE = 4;
const CELLS_PER_CHUNK = 8;
const SPAWN_CLEAR_RADIUS = 4;
const TYPE_SALT = 0x7a514e27;
const X_SALT = 0x493bdab5;
const Y_SALT = 0xc15a66d3;
const VARIANT_SALT = 0x1f83d9ab;

export type WorldObjectType =
  | "tree"
  | "appleTree"
  | "rock"
  | "grass"
  | "redMushroom"
  | "purpleMushroom"
  | "strawberryBush"
  | "bush"
  | "yellowFlower"
  | "pinkFlower"
  | "blueFlower"
  | "waterLily";

export interface WorldObject {
  id: string;
  type: WorldObjectType;
  x: number;
  y: number;
  variant: number;
}

function chooseType(value: number, biome: Biome): WorldObjectType | undefined {
  if (biome === "forest") {
    if (value < 42) return "tree";
    if (value < 58) return "appleTree";
    if (value < 67) return "bush";
    if (value < 73) return "strawberryBush";
    if (value < 79) return "rock";
    if (value < 84) return "grass";
    if (value < 88) return "redMushroom";
    if (value < 91) return "purpleMushroom";
    if (value < 95) return "yellowFlower";
    if (value < 98) return "blueFlower";
    return "pinkFlower";
  }

  if (value < 17) return "bush";
  if (value < 29) return "strawberryBush";
  if (value < 41) return "redMushroom";
  if (value < 51) return "purpleMushroom";
  if (value < 58) return "grass";
  if (value < 62) return "yellowFlower";
  if (value < 66) return "pinkFlower";
  if (value < 68) return "blueFlower";
  if (value < 71) return "rock";
  if (value < 73) return "tree";
  if (value < 74) return "appleTree";
  return undefined;
}

export function generateWorldObject(
  config: WorldConfig,
  cellX: number,
  cellY: number,
): WorldObject | undefined {
  const x =
    cellX * OBJECT_CELL_SIZE +
    1 +
    (hashWorld(config, cellX, cellY, X_SALT) % 2);
  const y =
    cellY * OBJECT_CELL_SIZE +
    1 +
    (hashWorld(config, cellX, cellY, Y_SALT) % 2);

  if (Math.abs(x) <= SPAWN_CLEAR_RADIUS && Math.abs(y) <= SPAWN_CLEAR_RADIUS) {
    return undefined;
  }

  const terrain = generateTerrainTile(config, x, y);

  const value = hashWorld(config, cellX, cellY, TYPE_SALT) % 100;
  const type =
    terrain.surface === "water"
      ? value < 25
        ? "waterLily"
        : undefined
      : chooseType(value, terrain.biome);

  if (!type) {
    return undefined;
  }

  return {
    id: `${type}:${x},${y}`,
    type,
    x,
    y,
    variant: hashWorld(config, cellX, cellY, VARIANT_SALT) % 2,
  };
}

export function generateChunkObjects(
  config: WorldConfig,
  chunkX: number,
  chunkY: number,
): WorldObject[] {
  const objects: WorldObject[] = [];
  const startCellX = chunkX * CELLS_PER_CHUNK;
  const startCellY = chunkY * CELLS_PER_CHUNK;

  for (let cellY = startCellY; cellY < startCellY + CELLS_PER_CHUNK; cellY++) {
    for (
      let cellX = startCellX;
      cellX < startCellX + CELLS_PER_CHUNK;
      cellX++
    ) {
      const object = generateWorldObject(config, cellX, cellY);

      if (object) {
        objects.push(object);
      }
    }
  }

  return objects;
}
