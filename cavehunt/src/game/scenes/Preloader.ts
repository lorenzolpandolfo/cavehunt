import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    preload ()
    {
        this.load.setPath('assets/sprout-lands');
        this.load.spritesheet('player', 'character.png', { frameWidth: 48, frameHeight: 48 });
        this.load.image('grass', 'grass.png');
        this.load.image('biome-objects', 'biome-objects.png');
        this.load.image('water', 'water.png');
        this.load.setPath('assets/mobs');
        this.load.spritesheet('cow', 'cow.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('chicken', 'chicken.png', { frameWidth: 16, frameHeight: 16 });
    }

    create ()
    {
        this.scene.start('Game');
    }
}
