import { Scene } from 'phaser';
import { chunkKey } from './chunk.ts';
import { AnimalPopulation, type AnimalState } from './animals.ts';
import { type WorldConfig } from './worldConfig.ts';

interface VisibleAnimal {
    state: AnimalState;
    sprite: Phaser.GameObjects.Sprite;
}

export class AnimalDisplay
{
    private readonly scene: Scene;
    private readonly population: AnimalPopulation;
    private readonly visible = new Map<string, VisibleAnimal[]>();

    constructor(scene: Scene, config: WorldConfig)
    {
        this.scene = scene;
        this.population = new AnimalPopulation(config);
        this.registerAnimations();
    }

    load(chunkX: number, chunkY: number): void
    {
        const key = chunkKey(chunkX, chunkY);
        const animals = this.population.load(chunkX, chunkY);
        const visible = animals.map(state => {
            const sprite = this.scene.add.sprite(state.x, state.y, state.type, 0);
            sprite.setOrigin(0.5, 1);
            sprite.setDepth(state.y);
            return { state, sprite };
        });
        this.visible.set(key, visible);
    }

    unload(chunkX: number, chunkY: number): void
    {
        const key = chunkKey(chunkX, chunkY);

        for (const animal of this.visible.get(key) ?? [])
        {
            animal.sprite.destroy();
        }

        this.visible.delete(key);
        this.population.unload(chunkX, chunkY);
    }

    update(deltaMs: number): void
    {
        this.population.update(deltaMs);

        for (const animals of this.visible.values())
        {
            for (const { state, sprite } of animals)
            {
                sprite.setPosition(state.x, state.y);
                sprite.setDepth(state.y);
                sprite.setFlipX(state.direction === 2);

                if (state.phase === 'walk')
                {
                    sprite.anims.play(`${state.type}-walk`, true);
                }
                else if (state.type === 'chicken')
                {
                    sprite.anims.play('chicken-idle', true);
                }
                else
                {
                    sprite.anims.stop();
                    sprite.setFrame(0);
                }
            }
        }
    }

    destroy(): void
    {
        for (const key of this.visible.keys())
        {
            const [chunkX, chunkY] = key.split(',').map(Number);
            this.unload(chunkX, chunkY);
        }

        this.population.destroy();
    }

    private registerAnimations(): void
    {
        const animations = [
            { key: 'cow-walk', texture: 'cow', frames: [0, 1, 2, 3, 4], frameRate: 6 },
            { key: 'chicken-walk', texture: 'chicken', frames: [4, 5, 6, 7], frameRate: 8 },
            { key: 'chicken-idle', texture: 'chicken', frames: [0, 1], frameRate: 3 }
        ];

        for (const animation of animations)
        {
            if (!this.scene.anims.exists(animation.key))
            {
                this.scene.anims.create({
                    key: animation.key,
                    frames: this.scene.anims.generateFrameNumbers(animation.texture, { frames: animation.frames }),
                    frameRate: animation.frameRate,
                    repeat: -1
                });
            }
        }
    }
}
