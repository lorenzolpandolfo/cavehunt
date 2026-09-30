import { Scene } from 'phaser';
import { type FoundationMap, isBlockedTile, TILE_SIZE } from './foundationMap';

const GRASS_TILE_INDEX = 12;
const FENCE_TILE_INDEX = 0;
const TREE_FRAME_WIDTH = 16;
const TREE_FRAME_HEIGHT = 32;
const TREE_BODY_WIDTH = 14;
const TREE_BODY_HEIGHT = 8;

export interface FoundationWorld {
    walls: Phaser.Tilemaps.TilemapLayer;
    obstacles: Phaser.Physics.Arcade.StaticGroup;
}

export function buildFoundationWorld(scene: Scene, map: FoundationMap): FoundationWorld
{
    const tilemap = scene.make.tilemap({ width: map.width, height: map.height, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const grassTileset = tilemap.addTilesetImage('grass', 'grass', TILE_SIZE, TILE_SIZE);
    const fenceTileset = tilemap.addTilesetImage('fences', 'fences', TILE_SIZE, TILE_SIZE);

    if (!grassTileset || !fenceTileset)
    {
        throw new Error('Foundation tilesets could not be loaded');
    }

    const ground = tilemap.createBlankLayer('ground', grassTileset);
    const walls = tilemap.createBlankLayer('walls', fenceTileset);

    if (!ground || !walls)
    {
        throw new Error('Foundation tilemap layers could not be created');
    }

    ground.fill(GRASS_TILE_INDEX);

    for (let y = 0; y < map.height; y++)
    {
        for (let x = 0; x < map.width; x++)
        {
            if (isBlockedTile(map, x, y))
            {
                walls.putTileAt(FENCE_TILE_INDEX, x, y);
            }
        }
    }

    walls.setCollision([FENCE_TILE_INDEX]);
    const obstacles = scene.physics.add.staticGroup();
    const texture = scene.textures.get('biome-objects');

    if (!texture.has('tree'))
    {
        texture.add('tree', 0, 0, 0, TREE_FRAME_WIDTH, TREE_FRAME_HEIGHT);
    }

    for (const tree of map.trees)
    {
        const x = (tree.x + 0.5) * TILE_SIZE;
        const y = (tree.y + 1) * TILE_SIZE;
        const image = obstacles.create(x, y, 'biome-objects', 'tree') as Phaser.Physics.Arcade.Image;
        image.setOrigin(0.5, 1);
        image.setDepth(y);
        image.refreshBody();
        const body = image.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(TREE_BODY_WIDTH, TREE_BODY_HEIGHT, false);
        body.setOffset((TREE_FRAME_WIDTH - TREE_BODY_WIDTH) / 2, TREE_FRAME_HEIGHT - TREE_BODY_HEIGHT);
    }

    return { walls, obstacles };
}
