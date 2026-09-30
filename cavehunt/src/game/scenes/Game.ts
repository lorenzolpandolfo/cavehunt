import { Scene } from 'phaser';
import { Player } from '../player/Player';
import { TILE_SIZE } from '../world/chunk';
import { ChunkManager } from '../world/ChunkManager';
import { destroyRenderedChunk, renderChunk, type RenderedChunk } from '../world/renderChunk';
import { WORLD_CONFIG } from '../world/terrain';
import { AnimalDisplay } from '../world/AnimalDisplay';

const CAMERA_ZOOM = 3;

interface LoadedChunk {
    x: number;
    y: number;
    rendered: RenderedChunk;
}

export class Game extends Scene
{
    private player?: Player;
    private chunks?: ChunkManager<LoadedChunk>;
    private animals?: AnimalDisplay;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const player = new Player(this, TILE_SIZE / 2, TILE_SIZE / 2);
        this.player = player;
        player.sprite.setVelocity(0, 0);
        const animals = new AnimalDisplay(this, WORLD_CONFIG);
        this.animals = animals;
        this.chunks = new ChunkManager(
            WORLD_CONFIG,
            chunk => {
                const rendered = renderChunk(this, player.sprite, chunk);
                animals.load(chunk.x, chunk.y);
                return { x: chunk.x, y: chunk.y, rendered };
            },
            chunk => {
                animals.unload(chunk.x, chunk.y);
                destroyRenderedChunk(chunk.rendered);
            }
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
            this.animals?.destroy();
            this.animals = undefined;
            this.player?.destroy();
            this.player = undefined;
        });
    }

    update (_time: number, delta: number)
    {
        this.player?.update();
        if (this.player)
        {
            this.chunks?.update(this.player.sprite.x, this.player.sprite.y);
        }
        this.animals?.update(delta);
    }
}
