import { Scene } from 'phaser';
import { type PlayerSnapshot } from '../../../../shared/src/protocol.ts';
import { PLAYER_FEET_OFFSET, SIMULATION_STEP_MS, type Direction } from '../../../../shared/src/movement.ts';

const DIRECTION_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

export class Player
{
    readonly sprite: Phaser.GameObjects.Sprite;
    private readonly label: Phaser.GameObjects.Text;
    private fromX: number;
    private fromY: number;
    private targetX: number;
    private targetY: number;
    private elapsed = SIMULATION_STEP_MS;

    constructor(scene: Scene, player: PlayerSnapshot)
    {
        this.fromX = this.targetX = player.x;
        this.fromY = this.targetY = player.y;
        this.registerAnimations(scene);
        this.sprite = scene.add.sprite(player.x, player.y + PLAYER_FEET_OFFSET, 'player', 0);
        this.sprite.setOrigin(0.5, 1);
        this.label = scene.add.text(player.x, player.y - 24, player.nickname, {
            fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
            backgroundColor: '#17351c', padding: { x: 2, y: 1 }
        }).setOrigin(0.5, 1);
        this.update(player);
        this.render(0);
    }

    update(player: PlayerSnapshot): void
    {
        if (player.x !== this.targetX || player.y !== this.targetY)
        {
            this.fromX = this.sprite.x;
            this.fromY = this.sprite.y - PLAYER_FEET_OFFSET;
            this.targetX = player.x;
            this.targetY = player.y;
            this.elapsed = 0;
        }
        this.label.setText(player.nickname);
        if (player.moving) this.sprite.anims.play(`walk-${player.direction}`, true);
        else
        {
            this.sprite.anims.stop();
            this.sprite.setFrame(DIRECTION_ROW[player.direction] * 4);
        }
    }

    render(deltaMs: number): void
    {
        this.elapsed = Math.min(SIMULATION_STEP_MS, this.elapsed + deltaMs);
        const alpha = this.elapsed / SIMULATION_STEP_MS;
        const x = this.fromX + (this.targetX - this.fromX) * alpha;
        const y = this.fromY + (this.targetY - this.fromY) * alpha;
        this.sprite.setPosition(x, y + PLAYER_FEET_OFFSET).setDepth(y);
        this.label.setPosition(x, y - 24).setDepth(y + 1);
    }

    destroy(): void
    {
        this.sprite.destroy();
        this.label.destroy();
    }

    private registerAnimations(scene: Scene): void
    {
        for (const direction of Object.keys(DIRECTION_ROW) as Direction[])
        {
            const key = `walk-${direction}`;
            if (!scene.anims.exists(key))
            {
                scene.anims.create({
                    key,
                    frames: scene.anims.generateFrameNumbers('player', {
                        start: DIRECTION_ROW[direction] * 4, end: DIRECTION_ROW[direction] * 4 + 3
                    }),
                    frameRate: 7, repeat: -1
                });
            }
        }
    }
}
