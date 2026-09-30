# Cavehunt

Cavehunt is a Phaser 4 client connected to a Node.js/TypeScript Colyseus server. One server process owns one persistent world and accepts multiple players (16 by default). Clients receive the map, global player presence and authoritative movement. Animals remain stationary; their simulation and other map events are later milestones.

## Run locally

Use Node.js 22.18 or newer. Install from the repository root:

```sh
npm ci
npm run dev:server
```

In a second terminal:

```sh
npm run dev:client
```

Open the Vite URL (normally `http://localhost:8080`) and enter a nickname. Another browser or tab can join with a different nickname. Use 3–24 ASCII letters, digits, underscores or hyphens. Nicknames are case-insensitive identities with no passwords: any user can recover a disconnected character by entering its nickname. An already connected nickname is rejected.

Move with WASD or arrow keys; hold Shift for triple debug speed. The server resolves movement and obstacle collisions at 20 Hz. Clients interpolate the received positions without local prediction. Water remains walkable. Losing focus or stopping input updates stops the character.

The client defaults to `http://localhost:2567`. For another machine, set `VITE_SERVER_URL` in `cavehunt/.env` to the server's reachable HTTP(S) address before starting/building the client. An HTTPS client requires an HTTPS/WSS server endpoint. Hosting and TLS termination are outside this milestone.

## Server configuration and persistence

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listening interface. |
| `PORT` | `2567` | Listening port. |
| `MAX_PLAYERS` | `16` | Positive integer connection limit; not a measured capacity guarantee. |
| `WORLD_FILE` | `server/data/world.json` | Save path; overrides are resolved against the process working directory. |

The JSON contains save/generator versions, world ID, seed, full generated chunks, objects, animal state and characters keyed by normalized nickname. Unvisited regions do not occupy the file. Online presence is transient. Every admission commits its character and nearby chunks before exposing them. Movement is saved every two seconds, on departure and on normal shutdown. Characters recover their saved position on the next connection; abrupt termination can lose recent unsaved movement. Movement waits at chunk boundaries until new chunks have been persisted. A storage failure stops movement and reports an error; saving is retried on the autosave interval.

Writes are serialized and replace the JSON atomically through a temporary file in the same directory. Only one process can hold `world.json.lock`. Invalid/incompatible saves stop startup without replacing the file. After an ungraceful process termination, verify that the PID recorded in the lock is no longer running before manually removing that lock. Do not remove a live process's lock. Runtime data and temporary files are ignored by Git.

The current generator is version 8 with seed `cavehunt`. Existing saves retain their configuration. Whole-file JSON persistence is intended for this initial single-process implementation; the file grows with explored chunks. No database, multiple rooms, accounts or automatic save migrations are included.

## Build and validation

From the repository root:

```sh
npm test
npm run typecheck
npm run build
npm start -w @cavehunt/server
```

Tests include procedural generation, JSON persistence, concurrent admission, nickname validation, movement/collisions, input timeout, real Colyseus clients, region streaming, disconnects and restart recovery. Network tests bind an ephemeral loopback port. No manual browser gameplay is required. Client commands such as `npm run dev-nolog`, `npm test` and `npm run build-nolog` remain available inside `cavehunt/`.

See [architecture](.agents/architecture.md), [testing](.agents/testing.md), [roadmap](docs/roadmap.md), and [asset credits](cavehunt/public/assets/sprout-lands/ASSET_CREDITS.md).
