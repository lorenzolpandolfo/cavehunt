import { Scene } from 'phaser';
import { Player } from '../player/Player';
import { PlayerInput } from '../player/PlayerInput';
import { LocalPrediction } from '../player/LocalPrediction';
import { ChunkManager } from '../world/ChunkManager';
import { destroyRenderedChunk, renderChunk, type RenderedChunk } from '../world/renderChunk';
import { AnimalDisplay } from '../world/AnimalDisplay';
import { WorldConnection } from '../network/WorldConnection';
import { NICKNAME_PATTERN, type ChunkSnapshot, type InitialWorld, type PlayerSnapshot } from '../../../../shared/src/protocol.ts';
import { pixelToChunk } from '../../../../shared/src/coordinates.ts';
import { objectRectangle, type Rectangle } from '../../../../shared/src/playerMovement.ts';

interface LoadedChunk {
    rendered: RenderedChunk;
    animals: AnimalDisplay;
    obstacles: Rectangle[];
}

const CAMERA_FOLLOW_LERP = 0.1;

export class Game extends Scene
{
    private readonly players = new Map<string, Player>();
    private chunks?: ChunkManager<LoadedChunk>;
    private connection?: WorldConnection;
    private controls?: PlayerInput;
    private prediction?: LocalPrediction;
    private obstacles: Rectangle[] = [];
    private form?: HTMLFormElement;
    private ownId?: string;
    private nickname = '';

    constructor()
    {
        super('Game');
    }

    create(): void
    {
        this.cameras.main.setZoom(3).setRoundPixels(true).removeBounds();
        this.showLogin();
        this.events.once('shutdown', () => {
            this.connection?.close();
            this.connection = undefined;
            this.form?.remove();
            this.form = undefined;
            this.clearWorld();
        });
    }

    update(_time: number, deltaMs: number): void
    {
        const local = this.ownId ? this.players.get(this.ownId) : undefined;
        if (local && this.controls && this.prediction)
            local.renderLocal(this.prediction.advance(deltaMs, this.controls.current()));
        for (const [id, player] of this.players)
            if (id !== this.ownId || !this.prediction) player.render(deltaMs);
        this.chunks?.forEachLoaded(chunk => chunk.animals.render(deltaMs));
    }

    private showLogin(message = 'Enter a nickname to join the world.'): void
    {
        this.form?.remove();
        const form = document.createElement('form');
        form.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;display:grid;gap:12px;padding:24px;background:#17351c;color:white;font:16px sans-serif;border-radius:8px;max-width:85vw;width:340px';
        const title = document.createElement('strong');
        title.textContent = 'Cavehunt Online';
        const status = document.createElement('p');
        status.textContent = message;
        status.setAttribute('role', 'status');
        const label = document.createElement('label');
        label.textContent = 'Nickname';
        const input = document.createElement('input');
        input.name = 'nickname';
        input.id = 'cavehunt-nickname';
        input.required = true;
        input.maxLength = 24;
        input.value = this.nickname;
        input.setAttribute('autocomplete', 'nickname');
        label.htmlFor = input.id;
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Connect';
        form.append(title, status, label, input, submit);
        form.onsubmit = event => {
            event.preventDefault();
            const nickname = input.value.trim();
            if (!NICKNAME_PATTERN.test(nickname))
            {
                status.textContent = 'Use 3–24 letters, numbers, underscores or hyphens.';
                return;
            }
            this.nickname = nickname;
            input.disabled = true;
            submit.disabled = true;
            status.textContent = 'Connecting and loading the world…';
            this.connection = new WorldConnection(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567', {
                world: world => this.loadWorld(world),
                players: players => this.updatePlayers(players),
                correction: correction => this.prediction?.correct(correction),
                chunks: window => this.applyChunks(window.chunks),
                animals: update => this.chunks?.get(update.x, update.y)?.animals.apply(update.animals),
                disconnected: reason => {
                    this.connection = undefined;
                    this.clearWorld();
                    this.showLogin(reason);
                }
            });
            void this.connection.connect(nickname);
        };
        document.body.append(form);
        this.form = form;
        input.focus();
    }

    private loadWorld(world: InitialWorld): void
    {
        this.ownId = world.playerId;
        this.chunks = new ChunkManager(
            chunk => ({
                rendered: renderChunk(this, chunk), animals: new AnimalDisplay(this, chunk.animals),
                obstacles: chunk.objects.flatMap(object => {
                    const rectangle = objectRectangle(object);
                    return rectangle ? [rectangle] : [];
                })
            }),
            chunk => { destroyRenderedChunk(chunk.rendered); chunk.animals.destroy(); }
        );
        this.applyChunks(world.chunks);
    }

    private applyChunks(chunks: readonly ChunkSnapshot[]): void
    {
        this.chunks?.apply(chunks);
        this.obstacles = [];
        this.chunks?.forEachLoaded(chunk => this.obstacles.push(...chunk.obstacles));
    }

    private updatePlayers(players: readonly PlayerSnapshot[]): void
    {
        const present = new Set(players.map(player => player.id));
        for (const [id, player] of this.players)
        {
            if (!present.has(id))
            {
                player.destroy();
                this.players.delete(id);
            }
        }
        for (const data of players)
        {
            const existing = this.players.get(data.id);
            if (existing) existing.update(data, data.id === this.ownId);
            else this.players.set(data.id, new Player(this, data));
            if (data.id === this.ownId)
            {
                if (!this.prediction)
                    this.prediction = new LocalPrediction(data, () => this.obstacles,
                        (x, y) => Boolean(this.chunks?.get(pixelToChunk(x), pixelToChunk(y))),
                        command => this.connection?.sendMovement(command));
            }
        }
        const own = this.ownId ? this.players.get(this.ownId) : undefined;
        if (own)
        {
            if (!this.controls)
            {
                this.controls = new PlayerInput(() => this.prediction?.stop());
                this.cameras.main.startFollow(own.sprite, true, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_LERP);
            }
            this.form?.remove();
            this.form = undefined;
        }
    }

    private clearWorld(): void
    {
        this.controls?.destroy();
        this.controls = undefined;
        this.prediction = undefined;
        this.cameras.main.stopFollow();
        this.chunks?.destroy();
        this.chunks = undefined;
        this.obstacles = [];
        for (const player of this.players.values()) player.destroy();
        this.players.clear();
        this.ownId = undefined;
    }

}
