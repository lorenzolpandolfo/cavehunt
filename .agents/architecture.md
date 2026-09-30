# Architecture

## Current state

- npm workspaces share one root lockfile. `cavehunt/` is the Phaser 4/Vite client, `server/` is the Node.js/TypeScript Colyseus server, and `shared/` contains serializable contracts, coordinates and movement/collision definitions without Phaser dependencies.
- Boot and Preloader load assets before Game shows a nickname form. MainMenu and GameOver remain unused template scenes. Runtime assets live in `cavehunt/public/assets/`; root `assets/` is not served by Vite.
- The server owns one persistent world and one room, including when empty. The default capacity is 16, configurable via MAX_PLAYERS. Room creation attempts after bootstrap are rejected; clients join the existing room.
- The world has seeded forests, plains, natural objects, walkable rivers/lakes and server-simulated cows/chickens. Player and animal movement are server-authoritative and synchronized. Test items support automatic pickup, inventory stacking and dropping. Combat, gathering and construction are not active online systems.

## Ownership and data flow

| Boundary | Responsibility |
| --- | --- |
| Server world | Generate terrain/objects/animals and own persistent character/chunk/item data. |
| Server storage | Validate saves, serialize commits, atomically replace JSON and hold an exclusive writer lock. |
| Server movement | Fixed-step player movement, input validation, collisions and one animal simulation per active chunk. |
| Colyseus adapter | Reserve nicknames, manage global presence, replicate movement and send relevant chunk windows and animal updates. |
| Shared contracts | Protocol/version, metadata, serializable state, coordinate conversions and common geometry. |
| Client presentation | Connection UI, move the local player, handle rejected positions, interpolate remote players/animals, animate sprites and release Phaser resources. |

Keep persistent domain data separate from Colyseus Schema instances and Phaser objects. Use plain serializable state. Add gameplay systems for concrete implemented features, without mandatory ECS or speculative frameworks.

Admission reserves a normalized nickname before asynchronous persistence. Existing characters are recovered by nickname without authentication; duplicate active nicknames are rejected. The Colyseus state contains connected players only. After installing handlers, clients request their initial world snapshot. On departure, presence is removed and position is flushed before releasing the nickname reservation.

## Movement and interest

- Clients send directional booleans, the Shift debug flag, their resulting position, a monotonic sequence and a correction epoch for each 50 ms movement step. The server validates the reported position against its own movement and collision simulation before accepting it.
- The server processes queued player reports at 20 Hz with 50 ms steps and capped catch-up. Normal speed is 80 pixels/second; Shift requests the existing triple-speed debug behavior. Invalid positions clear the queue and receive an explicit correction with a new epoch.
- World obstacles use shared foot-aligned bodies and swept axis collision resolution. Water and decorative objects remain traversable. Player-player and animal-player collisions are not implemented.
- The client owns its local position using shared collision rules and loaded chunks, sends one position per 50 ms step and eases the local sprite toward its partial-step pose each frame. Regular server snapshots update remote characters only. Explicit corrections adjust the local player, smoothing small differences. Blur/hidden tab sends an immediate stop.
- Global presence and validated player positions go to every client. Each client receives a 3 by 3 chunk window centered on the validated position. Crossing a boundary updates only that client's window. New chunks must be persisted before the server accepts movement into their window; the local player can move through loaded chunks while the server catches up.
- The network protocol is version 6. Incompatible clients are rejected. Disconnects return to the entry form without automatic reconnect or offline fallback.

## Deterministic generation

`server/src/world/` owns generator version 8, seed configuration, hashes, biomes, objects, rivers, lakes and animal rules. Original generation tests live in `server/tests/`. A fixed configuration reproduces initial chunks independently of generation order; preserve IDs, salts and cross-chunk continuity.

Tiles are 16 pixels and chunks contain 32 by 32 tiles. Initial spawns start around tile (0, 0), avoiding objects and connected players. Snapshots include terrain, objects, animals and a 34 by 34 surface grid with a one-tile border for shore rendering. The client does not generate terrain. Grass variants are coordinate-stable across clients.

ChunkManager reconciles received windows idempotently. AnimalDisplay interpolates server updates and plays cow/chicken animations; it never advances animal rules locally.

## Persistence

`server/data/world.json` stores save/generator versions, world ID, configuration, complete generated chunks with ground items, and characters with inventories keyed by normalized nickname. Unvisited regions are generated lazily. Online presence and sprite animation state are transient; complete animal simulation state is persisted. Three test items are placed near the first character's spawn in a new world. Item transfers are committed before publication, and drops remain unavailable to their owner until that character leaves pickup range. Save version 2 does not migrate version 1 files.

Admissions and newly generated chunks are serialized and committed atomically before publication. Player and animal movement update memory immediately and flush every two seconds, on departure and on normal shutdown; abrupt termination can lose recent unsaved movement. A save cannot overwrite movement that occurred while its disk write was in flight. A failed save suspends movement, reports the problem and retries on the autosave interval.

Startup validates saves before listening. Invalid/incompatible files remain untouched. An exclusive neighboring lock allows one writer; see the root README for stale-lock recovery. Whole-file JSON grows with exploration and is a single-process design, not distributed storage. No automatic save migrations are implemented.

The server advances animals once per chunk in the union of connected players' 3 by 3 windows. It sends changed visual states at 10 Hz only to clients subscribed to that chunk. Chunks pause when no players observe them; late joiners receive current persisted state. Combat, gathering, construction, caves and progression remain separate milestones.
