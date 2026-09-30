import { Scene } from 'phaser';
import { type AnimalState } from '../../../../shared/src/protocol.ts';

export class AnimalDisplay
{
    private readonly sprites: Phaser.GameObjects.Sprite[];

    constructor(scene: Scene, animals: readonly AnimalState[])
    {
        this.sprites = animals.map(animal => scene.add.sprite(animal.x, animal.y, animal.type, 0)
            .setOrigin(0.5, 1).setDepth(animal.y).setFlipX(animal.direction === 2));
    }

    destroy(): void
    {
        for (const sprite of this.sprites) sprite.destroy();
    }
}
