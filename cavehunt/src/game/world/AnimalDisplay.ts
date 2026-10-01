import { Scene } from 'phaser';
import { type AnimalMotion, type AnimalState } from '../../../../shared/src/protocol.ts';

const ANIMAL_UPDATE_MS = 100;

interface VisibleAnimal {
    sprite: Phaser.GameObjects.Sprite;
    type: AnimalState['type'];
    fromX: number;
    fromY: number;
    x: number;
    y: number;
    elapsed: number;
}

export class AnimalDisplay
{
    private readonly visible = new Map<string, VisibleAnimal>();

    constructor(scene: Scene, animals: readonly AnimalState[])
    {
        this.registerAnimations(scene);
        for (const animal of animals)
        {
            const sprite = scene.add.sprite(animal.x, animal.y, animal.type, 0).setOrigin(0.5, 1).setDepth(animal.y);
            sprite.setInteractive();
            sprite.name = 'world-target';
            this.visible.set(animal.id, {
                sprite, type: animal.type, fromX: animal.x, fromY: animal.y,
                x: animal.x, y: animal.y, elapsed: ANIMAL_UPDATE_MS
            });
            this.setAnimation(sprite, animal.type, animal);
        }
    }

    apply(animals: readonly AnimalMotion[]): void
    {
        for (const animal of animals)
        {
            const visible = this.visible.get(animal.id);
            if (!visible) continue;
            if (visible.x !== animal.x || visible.y !== animal.y)
            {
                visible.fromX = visible.sprite.x;
                visible.fromY = visible.sprite.y;
                visible.x = animal.x;
                visible.y = animal.y;
                visible.elapsed = 0;
            }
            this.setAnimation(visible.sprite, visible.type, animal);
        }
    }

    render(deltaMs: number): void
    {
        for (const animal of this.visible.values())
        {
            animal.elapsed = Math.min(ANIMAL_UPDATE_MS, animal.elapsed + deltaMs);
            const alpha = animal.elapsed / ANIMAL_UPDATE_MS;
            const x = animal.fromX + (animal.x - animal.fromX) * alpha;
            const y = animal.fromY + (animal.y - animal.fromY) * alpha;
            animal.sprite.setPosition(x, y).setDepth(y);
        }
    }

    destroy(): void
    {
        for (const animal of this.visible.values()) animal.sprite.destroy();
        this.visible.clear();
    }

    private setAnimation(sprite: Phaser.GameObjects.Sprite, type: AnimalState['type'], animal: AnimalMotion): void
    {
        sprite.setFlipX(animal.direction === 2);
        if (animal.phase === 'walk') sprite.anims.play(`${type}-walk`, true);
        else if (type === 'chicken') sprite.anims.play('chicken-idle', true);
        else
        {
            sprite.anims.stop();
            sprite.setFrame(0);
        }
    }

    private registerAnimations(scene: Scene): void
    {
        const animations = [
            { key: 'cow-walk', texture: 'cow', frames: [0, 1, 2, 3, 4], frameRate: 6 },
            { key: 'chicken-walk', texture: 'chicken', frames: [4, 5, 6, 7], frameRate: 8 },
            { key: 'chicken-idle', texture: 'chicken', frames: [0, 1], frameRate: 3 }
        ];
        for (const animation of animations)
        {
            if (!scene.anims.exists(animation.key))
            {
                scene.anims.create({
                    key: animation.key,
                    frames: scene.anims.generateFrameNumbers(animation.texture, { frames: animation.frames }),
                    frameRate: animation.frameRate,
                    repeat: -1
                });
            }
        }
    }
}
