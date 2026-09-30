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
    }

    create ()
    {
        this.scene.start('Game');
    }
}
