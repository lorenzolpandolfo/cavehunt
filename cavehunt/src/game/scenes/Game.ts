import { Scene } from 'phaser';
import { Player } from '../player/Player';
import { PlayerInput } from '../player/PlayerInput';
import { LocalPrediction } from '../player/LocalPrediction';
import { ChunkManager } from '../world/ChunkManager';
import { destroyRenderedChunk, renderChunk, setRenderedItems, type RenderedChunk } from '../world/renderChunk';
import { AnimalDisplay } from '../world/AnimalDisplay';
import { WorldConnection } from '../network/WorldConnection';
import { NICKNAME_PATTERN, type ChunkSnapshot, type InitialWorld, type PlayerSnapshot, type InventoryEntry, type ItemUpdate } from '../../../../shared/src/protocol.ts';
import { ITEMS } from '../../../../shared/src/items.ts';
import { pixelToChunk } from '../../../../shared/src/coordinates.ts';
import { objectRectangle, type Rectangle } from '../../../../shared/src/playerMovement.ts';

interface LoadedChunk {
    rendered: RenderedChunk;
    animals: AnimalDisplay;
    obstacles: Rectangle[];
}

const CAMERA_FOLLOW_LERP = 0.1;
const DEFAULT_SERVER_PORT = '2567';

function serverEndpoint(address: string): string | undefined
{
    try
    {
        const url = new URL(/^https?:\/\//i.test(address) ? address : `http://${address}`);
        if (!url.hostname || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
            return undefined;
        if (!url.port) url.port = DEFAULT_SERVER_PORT;
        return url.origin;
    }
    catch
    {
        return undefined;
    }
}

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
    private serverAddress = import.meta.env.VITE_SERVER_URL ?? 'localhost:2567';
    private inventory: InventoryEntry[] = [];
    private selectedEntryId?: string;
    private inventoryHud?: HTMLDivElement;

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
        const serverLabel = document.createElement('label');
        serverLabel.textContent = 'Server IP or host';
        const serverInput = document.createElement('input');
        serverInput.name = 'server';
        serverInput.id = 'cavehunt-server';
        serverInput.required = true;
        serverInput.value = this.serverAddress;
        serverInput.placeholder = 'localhost:2567';
        serverLabel.htmlFor = serverInput.id;
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Connect';
        form.append(title, status, label, input, serverLabel, serverInput, submit);
        form.onsubmit = event => {
            event.preventDefault();
            const nickname = input.value.trim();
            if (!NICKNAME_PATTERN.test(nickname))
            {
                status.textContent = 'Use 3–24 letters, numbers, underscores or hyphens.';
                return;
            }
            const address = serverInput.value.trim();
            const endpoint = serverEndpoint(address);
            if (!endpoint)
            {
                status.textContent = 'Enter a valid server IP or host, optionally with a port.';
                return;
            }
            this.nickname = nickname;
            this.serverAddress = address;
            input.disabled = true;
            serverInput.disabled = true;
            submit.disabled = true;
            status.textContent = 'Connecting and loading the world…';
            this.connection = new WorldConnection(endpoint, {
                world: world => this.loadWorld(world),
                players: players => this.updatePlayers(players),
                correction: correction => this.prediction?.correct(correction),
                chunks: window => this.applyChunks(window.chunks),
                animals: update => this.chunks?.get(update.x, update.y)?.animals.apply(update.animals),
                inventory: inventory => this.updateInventory(inventory),
                groundItems: update => this.updateGroundItems(update),
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
        this.updateInventory(world.inventory);
        this.inventoryHud = document.createElement('div');
        this.inventoryHud.style.cssText = 'position:fixed;left:12px;top:12px;z-index:5;padding:8px 10px;background:#17351cdd;color:white;font:14px sans-serif;white-space:pre-line;pointer-events:none;max-height:50vh;overflow:hidden';
        document.body.append(this.inventoryHud);
        window.addEventListener('keydown', this.onItemKeyDown);
        this.renderInventory();
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

    private updateInventory(inventory: InventoryEntry[]): void
    {
        this.inventory = inventory;
        if (!inventory.some(entry => entry.id === this.selectedEntryId))
            this.selectedEntryId = inventory[0]?.id;
        this.renderInventory();
    }

    private renderInventory(): void
    {
        if (!this.inventoryHud) return;
        const lines = ['Inventory  |  F select  Q drop'];
        if (this.inventory.length === 0) lines.push('Empty');
        for (const entry of this.inventory)
            lines.push(`${entry.id === this.selectedEntryId ? '> ' : '  '}${ITEMS[entry.itemId].title} ×${entry.quantity}`);
        this.inventoryHud.textContent = lines.join('\n');
    }

    private updateGroundItems(update: ItemUpdate): void
    {
        const chunk = this.chunks?.get(update.x, update.y);
        if (chunk) setRenderedItems(this, chunk.rendered, update.items);
    }

    private readonly onItemKeyDown = (event: KeyboardEvent): void =>
    {
        if (event.repeat || this.inventory.length === 0 || !this.ownId) return;
        if (event.code === 'KeyF')
        {
            event.preventDefault();
            const index = this.inventory.findIndex(entry => entry.id === this.selectedEntryId);
            this.selectedEntryId = this.inventory[(index + 1) % this.inventory.length].id;
            this.renderInventory();
        }
        else if (event.code === 'KeyQ' && this.selectedEntryId)
        {
            event.preventDefault();
            this.connection?.dropItem(this.selectedEntryId);
        }
    };

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
        window.removeEventListener('keydown', this.onItemKeyDown);
        this.inventoryHud?.remove();
        this.inventoryHud = undefined;
        this.inventory = [];
        this.selectedEntryId = undefined;
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
