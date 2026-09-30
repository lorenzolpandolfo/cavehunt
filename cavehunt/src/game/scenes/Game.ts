import { Scene } from 'phaser';
import { Player } from '../player/Player';
import { TILE_SIZE } from '../world/chunk';
import { ChunkManager } from '../world/ChunkManager';
import { destroyRenderedChunk, renderChunk, type RenderedChunk } from '../world/renderChunk';
import { WORLD_CONFIG } from '../world/terrain';

const CAMERA_ZOOM = 3;

export class Game extends Scene
{
    private player?: Player;
    private chunks?: ChunkManager<RenderedChunk>;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const player = new Player(this, TILE_SIZE / 2, TILE_SIZE / 2);
        this.player = player;
        player.sprite.setVelocity(0, 0);
        this.chunks = new ChunkManager(
            WORLD_CONFIG,
            chunk => renderChunk(this, player.sprite, chunk),
            destroyRenderedChunk
        );
        this.chunks.update(player.sprite.x, player.sprite.y);

        const camera = this.cameras.main;
        camera.setZoom(CAMERA_ZOOM);
        camera.setRoundPixels(true);
        camera.removeBounds();
        camera.startFollow(player.sprite, true);

        this.events.once('shutdown', () => {
            this.chunks?.destroy();
            this.chunks = undefined;
            this.player?.destroy();
            this.player = undefined;
        });
    }

    update ()
    {
        this.player?.update();
        if (this.player)
        {
            this.chunks?.update(this.player.sprite.x, this.player.sprite.y);
        }
    }
}
