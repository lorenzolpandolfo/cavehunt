import { Scene } from 'phaser';
import { CHUNK_PIXEL_SIZE, CHUNK_SIZE, type ChunkData, TILE_SIZE } from './chunk.ts';
import { type WorldObject, type WorldObjectType } from './worldObjects.ts';
import { OBJECT_FRAMES } from './objectFrames.ts';
import { getSurface } from './surface.ts';

const GRASS_TILE_INDEX = 12;
const GRASS_TILE_COUNT = 77;
const WATER_TILE_INDEX = GRASS_TILE_COUNT;
const TERRAIN_DEPTH = -1000000;
const PLAIN_COLOR = 0xffffff;
const FOREST_COLOR = 0xb6d6a0;

export interface RenderedChunk {
    tilemap: Phaser.Tilemaps.Tilemap;
    obstacles: Phaser.Physics.Arcade.StaticGroup;
    collider: Phaser.Physics.Arcade.Collider;
    decorations: Phaser.GameObjects.Image[];
}

function shoreTileIndex(chunk: ChunkData, tileX: number, tileY: number): number
{
    const water = (x: number, y: number) => getSurface(chunk.config, x, y) === 'water';
    const top = water(tileX, tileY - 1);
    const bottom = water(tileX, tileY + 1);
    const left = water(tileX - 1, tileY);
    const right = water(tileX + 1, tileY);

    if (top && left) return 0;
    if (top && right) return 2;
    if (bottom && left) return 22;
    if (bottom && right) return 24;
    if (top) return 1;
    if (bottom) return 23;
    if (left) return 11;
    if (right) return 13;
    return GRASS_TILE_INDEX;
}

function frameName(object: WorldObject): string
{
    return `${object.type}-${object.variant}`;
}

function ensureObjectFrames(scene: Scene): void
{
    const texture = scene.textures.get('biome-objects');

    for (const type of Object.keys(OBJECT_FRAMES) as WorldObjectType[])
    {
        for (const [variant, frame] of OBJECT_FRAMES[type].entries())
        {
            const name = `${type}-${variant}`;

            if (!texture.has(name))
            {
                texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
            }
        }
    }
}

function groundTint(blend: number): number
{
    const color = (from: number, to: number) => Math.round(from + (to - from) * blend);
    const red = color((PLAIN_COLOR >> 16) & 0xff, (FOREST_COLOR >> 16) & 0xff);
    const green = color((PLAIN_COLOR >> 8) & 0xff, (FOREST_COLOR >> 8) & 0xff);
    const blue = color(PLAIN_COLOR & 0xff, FOREST_COLOR & 0xff);

    return (red << 16) | (green << 8) | blue;
}

export function renderChunk(scene: Scene, player: Phaser.Physics.Arcade.Sprite, chunk: ChunkData): RenderedChunk
{
    ensureObjectFrames(scene);
    const tilemap = scene.make.tilemap({ width: CHUNK_SIZE, height: CHUNK_SIZE, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const grassTileset = tilemap.addTilesetImage('grass', 'grass', TILE_SIZE, TILE_SIZE);
    const waterTileset = tilemap.addTilesetImage('water', 'water', TILE_SIZE, TILE_SIZE, 0, 0, WATER_TILE_INDEX);

    if (!grassTileset || !waterTileset)
    {
        throw new Error('World tilesets could not be loaded');
    }

    const originX = chunk.x * CHUNK_PIXEL_SIZE;
    const originY = chunk.y * CHUNK_PIXEL_SIZE;
    const ground = tilemap.createBlankLayer('ground', grassTileset, originX, originY);
    const water = tilemap.createBlankLayer('water', waterTileset, originX, originY);

    if (!ground || !water)
    {
        throw new Error('World layers could not be created');
    }

    ground.setDepth(TERRAIN_DEPTH);
    water.setDepth(TERRAIN_DEPTH + 1);
    ground.fill(GRASS_TILE_INDEX);

    for (let y = 0; y < CHUNK_SIZE; y++)
    {
        for (let x = 0; x < CHUNK_SIZE; x++)
        {
            const tile = chunk.tiles[y][x];
            const worldX = chunk.x * CHUNK_SIZE + x;
            const worldY = chunk.y * CHUNK_SIZE + y;
            const groundTile = ground.putTileAt(tile.surface === 'ground' ? shoreTileIndex(chunk, worldX, worldY) : GRASS_TILE_INDEX, x, y);
            groundTile.tint = groundTint(tile.forestBlend);

            if (tile.surface === 'water')
            {
                water.putTileAt(WATER_TILE_INDEX, x, y).tint = 0x90d6df;
            }
        }
    }

    const obstacles = scene.physics.add.staticGroup();
    const decorations: Phaser.GameObjects.Image[] = [];

    for (const object of chunk.objects)
    {
        const frame = OBJECT_FRAMES[object.type][object.variant];
        const x = (object.x + 0.5) * TILE_SIZE;
        const y = (object.y + 1) * TILE_SIZE;

        if (frame.bodyWidth && frame.bodyHeight)
        {
            const image = obstacles.create(x, y, 'biome-objects', frameName(object)) as Phaser.Physics.Arcade.Image;
            image.setOrigin(0.5, 1);
            image.setDepth(y);
            image.refreshBody();
            const body = image.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(frame.bodyWidth, frame.bodyHeight, false);
            body.setOffset((frame.width - frame.bodyWidth) / 2, frame.height - frame.bodyHeight);
        }
        else
        {
            const image = scene.add.image(x, y, 'biome-objects', frameName(object));
            image.setOrigin(0.5, 1);
            image.setDepth(y - 1);
            decorations.push(image);
        }
    }

    return {
        tilemap,
        obstacles,
        collider: scene.physics.add.collider(player, obstacles),
        decorations
    };
}

export function destroyRenderedChunk(chunk: RenderedChunk): void
{
    chunk.collider.destroy();
    chunk.obstacles.destroy(true);

    for (const decoration of chunk.decorations)
    {
        decoration.destroy();
    }

    chunk.tilemap.destroy();
}
