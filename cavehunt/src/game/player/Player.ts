import { Scene } from 'phaser';
import { calculateVelocity, type MovementInput, type Velocity } from './movement';

const PLAYER_SPEED = 80;
const PLAYER_BODY_WIDTH = 12;
const PLAYER_BODY_HEIGHT = 7;
const ANIMATION_RATE = 7;

type Direction = 'down' | 'up' | 'left' | 'right';

const DIRECTION_ROW: Record<Direction, number> = {
    down: 0,
    up: 1,
    left: 2,
    right: 3
};

export class Player
{
    readonly sprite: Phaser.Physics.Arcade.Sprite;

    private readonly keys: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly input: MovementInput = { left: false, right: false, up: false, down: false };
    private readonly velocity: Velocity = { x: 0, y: 0 };
    private direction: Direction = 'down';
    private blurred = false;

    constructor(scene: Scene, x: number, y: number)
    {
        if (!scene.input.keyboard)
        {
            throw new Error('Keyboard input is unavailable');
        }

        this.registerAnimations(scene);
        this.sprite = scene.physics.add.sprite(x, y, 'player', DIRECTION_ROW.down * 4);
        this.sprite.setOrigin(0.5, 1);
        this.sprite.setBodySize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT);
        this.sprite.setOffset((48 - PLAYER_BODY_WIDTH) / 2, 48 - PLAYER_BODY_HEIGHT - 14);
        this.sprite.setDepth(y);

        this.keys = scene.input.keyboard.addKeys('W,A,S,D') as typeof this.keys;
        this.cursors = scene.input.keyboard.createCursorKeys();
        scene.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D']);
        window.addEventListener('blur', this.onBlur);
        window.addEventListener('focus', this.onFocus);
    }

    update()
    {
        const input = this.input;
        input.left = !this.blurred && (this.keys.A.isDown || this.cursors.left.isDown);
        input.right = !this.blurred && (this.keys.D.isDown || this.cursors.right.isDown);
        input.up = !this.blurred && (this.keys.W.isDown || this.cursors.up.isDown);
        input.down = !this.blurred && (this.keys.S.isDown || this.cursors.down.isDown);

        const velocity = calculateVelocity(input, PLAYER_SPEED, this.velocity);
        this.sprite.setVelocity(velocity.x, velocity.y);

        if (velocity.x !== 0 || velocity.y !== 0)
        {
            this.direction = velocity.x > 0 ? 'right' : velocity.x < 0 ? 'left' : velocity.y > 0 ? 'down' : 'up';
            this.sprite.anims.play(`walk-${this.direction}`, true);
        }
        else
        {
            this.sprite.anims.stop();
            this.sprite.setFrame(DIRECTION_ROW[this.direction] * 4);
        }

        this.sprite.setDepth(this.sprite.y);
    }

    destroy()
    {
        window.removeEventListener('blur', this.onBlur);
        window.removeEventListener('focus', this.onFocus);
        this.sprite.destroy();
    }

    private readonly onBlur = () =>
    {
        this.blurred = true;
        this.sprite.setVelocity(0, 0);
        this.sprite.anims.stop();
    };

    private readonly onFocus = () =>
    {
        this.blurred = false;
    };

    private registerAnimations(scene: Scene)
    {
        for (const direction of Object.keys(DIRECTION_ROW) as Direction[])
        {
            const key = `walk-${direction}`;

            if (!scene.anims.exists(key))
            {
                scene.anims.create({
                    key,
                    frames: scene.anims.generateFrameNumbers('player', {
                        start: DIRECTION_ROW[direction] * 4,
                        end: DIRECTION_ROW[direction] * 4 + 3
                    }),
                    frameRate: ANIMATION_RATE,
                    repeat: -1
                });
            }
        }
    }
}
