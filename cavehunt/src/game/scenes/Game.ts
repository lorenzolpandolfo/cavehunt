import { Scene } from 'phaser';
import { Player } from '../player/Player';
import { FOUNDATION_MAP, TILE_SIZE } from '../world/foundationMap';
import { buildFoundationWorld } from '../world/buildFoundationWorld';

const CAMERA_ZOOM = 3;

export class Game extends Scene
{
    private player?: Player;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const world = buildFoundationWorld(this, FOUNDATION_MAP);
        const spawn = FOUNDATION_MAP.spawn;

        this.player = new Player(this, (spawn.x + 0.5) * TILE_SIZE, (spawn.y + 1) * TILE_SIZE);
        this.physics.add.collider(this.player.sprite, world.walls);
        this.physics.add.collider(this.player.sprite, world.obstacles);
        this.physics.world.setBounds(0, 0, FOUNDATION_MAP.width * TILE_SIZE, FOUNDATION_MAP.height * TILE_SIZE);
        this.player.sprite.setCollideWorldBounds(true);

        const camera = this.cameras.main;
        camera.setZoom(CAMERA_ZOOM);
        camera.setRoundPixels(true);
        camera.setBounds(0, 0, FOUNDATION_MAP.width * TILE_SIZE, FOUNDATION_MAP.height * TILE_SIZE);
        camera.startFollow(this.player.sprite, true);

        this.events.once('shutdown', () => {
            this.player?.destroy();
            this.player = undefined;
        });
    }

    update ()
    {
        this.player?.update();
    }
}
