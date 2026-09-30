import { SIMULATION_STEP_MS, idleMovement, type MovementCommand, type MovementIntent } from '../../../../shared/src/movement.ts';
import { movePlayer, type MovingPlayer, type Rectangle } from '../../../../shared/src/playerMovement.ts';
import { type PlayerCorrection, type PlayerSnapshot } from '../../../../shared/src/protocol.ts';

const MAX_FRAME_MS = 250;
const CORRECTION_MS = 100;
const SNAP_DISTANCE = 12;
const VISUAL_SMOOTHING_MS = 30;
const VISUAL_SETTLE_DISTANCE = 0.05;

export class LocalPrediction
{
    private position: MovingPlayer;
    private visual: MovingPlayer;
    private elapsed = 0;
    private nextSequence = 0;
    private epoch = 0;
    private intent: MovementIntent = idleMovement();
    private correctionX = 0;
    private correctionY = 0;
    private correctionRemaining = 0;
    private readonly obstacles: () => readonly Rectangle[];
    private readonly canEnter: (x: number, y: number) => boolean;
    private readonly send: (command: MovementCommand) => void;

    constructor(
        initial: PlayerSnapshot,
        obstacles: () => readonly Rectangle[],
        canEnter: (x: number, y: number) => boolean,
        send: (command: MovementCommand) => void
    )
    {
        this.obstacles = obstacles;
        this.canEnter = canEnter;
        this.send = send;
        this.position = this.pose(initial);
        this.visual = this.pose(initial);
    }

    advance(deltaMs: number, input: MovementIntent): MovingPlayer
    {
        this.intent = input;
        this.elapsed += Math.min(deltaMs, MAX_FRAME_MS);
        while (this.elapsed >= SIMULATION_STEP_MS)
        {
            this.position = this.simulate(this.position, input, SIMULATION_STEP_MS);
            this.sendPosition(input);
            this.elapsed -= SIMULATION_STEP_MS;
        }
        if (this.correctionRemaining > 0)
        {
            const remaining = Math.max(0, this.correctionRemaining - deltaMs);
            const ratio = remaining / this.correctionRemaining;
            this.correctionX *= ratio;
            this.correctionY *= ratio;
            this.correctionRemaining = remaining;
        }
        const target = this.preview();
        const alpha = 1 - Math.exp(-deltaMs / VISUAL_SMOOTHING_MS);
        const x = this.visual.x + (target.x - this.visual.x) * alpha;
        const y = this.visual.y + (target.y - this.visual.y) * alpha;
        this.visual = {
            x, y, direction: target.direction,
            moving: target.moving || Math.hypot(target.x - x, target.y - y) > VISUAL_SETTLE_DISTANCE
        };
        return this.visual;
    }

    correct(correction: PlayerCorrection): void
    {
        if (correction.epoch <= this.epoch) return;
        const previous = this.visual;
        this.epoch = correction.epoch;
        this.position = this.pose(correction);
        this.elapsed = 0;
        this.correctionX = previous.x - correction.x;
        this.correctionY = previous.y - correction.y;
        if (Math.hypot(this.correctionX, this.correctionY) >= SNAP_DISTANCE)
        {
            this.correctionX = 0;
            this.correctionY = 0;
        }
        this.correctionRemaining = this.correctionX || this.correctionY ? CORRECTION_MS : 0;
        this.visual = this.preview();
    }

    stop(): void
    {
        this.elapsed = 0;
        this.intent = idleMovement();
        this.visual = this.position;
        this.sendPosition(this.intent);
    }

    private sendPosition(input: MovementIntent): void
    {
        this.send({ ...input, x: this.position.x, y: this.position.y, epoch: this.epoch, sequence: this.nextSequence++ });
    }

    private preview(): MovingPlayer
    {
        const pose = this.simulate(this.position, this.intent, this.elapsed);
        return { ...pose, x: pose.x + this.correctionX, y: pose.y + this.correctionY };
    }

    private simulate(player: MovingPlayer, input: MovementIntent, deltaMs: number): MovingPlayer
    {
        const next = movePlayer(player, input, deltaMs, this.obstacles());
        return this.canEnter(next.x, next.y) ? next : { ...player, moving: false };
    }

    private pose(player: Pick<PlayerSnapshot, 'x' | 'y' | 'direction' | 'moving'>): MovingPlayer
    {
        return { x: player.x, y: player.y, direction: player.direction, moving: player.moving };
    }
}
