import { Scene } from "phaser";
import {
  CHUNK_PIXEL_SIZE,
  CHUNK_SIZE,
  TILE_SIZE,
} from "../../../../shared/src/coordinates.ts";
import { type ChunkSnapshot, type WorldObject, type WorldObjectType } from "../../../../shared/src/protocol.ts";
import { type GroundItem } from "../../../../shared/src/protocol.ts";
import { ITEMS } from "../../../../shared/src/items.ts";
import { OBJECT_FRAMES } from "./objectFrames.ts";
import { shoreTileIndex } from "./shore.ts";

const GRASS_TILE_COUNT = 77;
const WATER_TILE_INDEX = GRASS_TILE_COUNT;
const TERRAIN_DEPTH = -1000000;
const PLAIN_COLOR = 0xffffff;
const FOREST_COLOR = 0xb6d6a0;
const ITEM_FLOAT_AMPLITUDE = 3;
const ITEM_FLOAT_PERIOD_MS = 1600;

interface RenderedItem {
  image: Phaser.GameObjects.Image;
  groundY: number;
}

export interface RenderedChunk {
  tilemap: Phaser.Tilemaps.Tilemap;
  decorations: Phaser.GameObjects.Image[];
  items: Map<string, RenderedItem>;
}

function groundTileIndex(
  chunk: ChunkSnapshot,
  tileX: number,
  tileY: number,
): number {
  return shoreTileIndex(
    (offsetX, offsetY) =>
      chunk.surfaces[tileY + offsetY + 1][tileX + offsetX + 1] === "water",
    Math.imul(chunk.x * CHUNK_SIZE + tileX, 73856093) ^ Math.imul(chunk.y * CHUNK_SIZE + tileY, 19349663),
  );
}

function frameName(object: WorldObject): string {
  return `${object.type}-${object.variant}`;
}

function ensureObjectFrames(scene: Scene): void {
  const texture = scene.textures.get("biome-objects");

  for (const type of Object.keys(OBJECT_FRAMES) as WorldObjectType[]) {
    for (const [variant, frame] of OBJECT_FRAMES[type].entries()) {
      const name = `${type}-${variant}`;

      if (!texture.has(name)) {
        texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
      }
    }
  }
  for (const definition of Object.values(ITEMS)) {
    const frame = `item-${definition.id}`;
    if (!texture.has(frame)) {
      const { x, y, width, height } = definition.texture;
      texture.add(frame, 0, x, y, width, height);
    }
  }
}

export function setRenderedItems(scene: Scene, rendered: RenderedChunk, items: readonly GroundItem[]): void {
  const present = new Set(items.map(item => item.id));
  for (const [id, item] of rendered.items) {
    if (!present.has(id)) { item.image.destroy(); rendered.items.delete(id); }
  }
  for (const item of items) {
    if (rendered.items.has(item.id)) continue;
    const image = scene.add.image(item.x, item.y, ITEMS[item.itemId].texture.key, `item-${item.itemId}`);
    image.setOrigin(0.5, 1).setDepth(item.y + 1);
    rendered.items.set(item.id, { image, groundY: item.y });
  }
}

export function animateRenderedItems(rendered: RenderedChunk, timeMs: number): void {
  const offsetY = Math.sin(timeMs * 2 * Math.PI / ITEM_FLOAT_PERIOD_MS) * ITEM_FLOAT_AMPLITUDE;
  for (const item of rendered.items.values()) item.image.y = item.groundY + offsetY;
}

function groundTint(blend: number): number {
  const color = (from: number, to: number) =>
    Math.round(from + (to - from) * blend);
  const red = color((PLAIN_COLOR >> 16) & 0xff, (FOREST_COLOR >> 16) & 0xff);
  const green = color((PLAIN_COLOR >> 8) & 0xff, (FOREST_COLOR >> 8) & 0xff);
  const blue = color(PLAIN_COLOR & 0xff, FOREST_COLOR & 0xff);

  return (red << 16) | (green << 8) | blue;
}

export function renderChunk(
  scene: Scene,
  chunk: ChunkSnapshot,
): RenderedChunk {
  ensureObjectFrames(scene);
  const tilemap = scene.make.tilemap({
    width: CHUNK_SIZE,
    height: CHUNK_SIZE,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
  });
  const grassTileset = tilemap.addTilesetImage(
    "grass",
    "grass",
    TILE_SIZE,
    TILE_SIZE,
  );
  const waterTileset = tilemap.addTilesetImage(
    "water",
    "water",
    TILE_SIZE,
    TILE_SIZE,
    0,
    0,
    WATER_TILE_INDEX,
  );

  if (!grassTileset || !waterTileset) {
    throw new Error("World tilesets could not be loaded");
  }

  const originX = chunk.x * CHUNK_PIXEL_SIZE;
  const originY = chunk.y * CHUNK_PIXEL_SIZE;
  const ground = tilemap.createBlankLayer(
    "ground",
    grassTileset,
    originX,
    originY,
  );
  const water = tilemap.createBlankLayer(
    "water",
    waterTileset,
    originX,
    originY,
  );

  if (!ground || !water) {
    throw new Error("World layers could not be created");
  }

  water.setDepth(TERRAIN_DEPTH);
  ground.setDepth(TERRAIN_DEPTH + 1);

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const tile = chunk.tiles[y][x];
      water.putTileAt(WATER_TILE_INDEX, x, y).tint = 0x90d6df;

      if (tile.surface === "ground") {
        ground.putTileAt(groundTileIndex(chunk, x, y), x, y).tint =
          groundTint(tile.forestBlend);
      }
    }
  }

  const decorations: Phaser.GameObjects.Image[] = [];

  for (const object of chunk.objects) {
    const frame = OBJECT_FRAMES[object.type][object.variant];
    const x = (object.x + 0.5) * TILE_SIZE;
    const y = (object.y + 1) * TILE_SIZE;

    const image = scene.add.image(x, y, "biome-objects", frameName(object));
    image.setOrigin(0.5, 1);
    image.setDepth(frame.bodyWidth ? y : y - 1);
    decorations.push(image);
  }

  const rendered: RenderedChunk = {
    tilemap,
    decorations,
    items: new Map(),
  };
  setRenderedItems(scene, rendered, chunk.items);
  return rendered;
}

export function destroyRenderedChunk(chunk: RenderedChunk): void {

  for (const decoration of chunk.decorations) {
    decoration.destroy();
  }
  for (const item of chunk.items.values()) item.image.destroy();
  chunk.items.clear();

  chunk.tilemap.destroy();
}
