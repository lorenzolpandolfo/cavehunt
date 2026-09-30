# Architecture

## Current state

Paths in this section are relative to the repository root.

- The application is in `cavehunt/`, with its own `package.json` and dependencies.
- The manifest declares Phaser 4.0.0, TypeScript ~5.7.2, and Vite ^6.3.1. Its legacy Phaser 3 description is not the dependency version.
- `cavehunt/src/main.ts` starts the application; `cavehunt/src/game/main.ts` configures Phaser.
- `cavehunt/src/game/scenes/` contains Boot, Preloader, and the active Game scene. MainMenu and GameOver remain as unused template files.
- `cavehunt/public/assets/` holds assets served directly at runtime. The separate root `assets/` directory is not automatically served by Vite.
- Vite configurations live in `cavehunt/vite/`. TypeScript uses strict mode with `strictPropertyInitialization` disabled.
- The Foundation provides a controllable player, Arcade Physics collisions, and a following camera. The seeded, unbounded surface now has forest and plain regions, natural objects, walkable rivers and lakes, and roaming cows and chickens. Persistence and networking have not been implemented.

## Intended direction

The following principles guide future changes; they do not describe existing modules or require a directory restructure.

| Responsibility | Boundary |
| --- | --- |
| Rendering and scenes | Display state, collect input, and manage Phaser resources and scene transitions. |
| Gameplay logic | Apply rules and resolve actions independently of Phaser when practical. |
| World state | Own terrain, resources, player modifications, and persistent entity data. |
| Entities | Represent identifiable actors or objects; keep their gameplay data distinct from display objects where useful. |
| Systems | Coordinate a focused behavior over relevant state, without becoming a universal framework. |
| UI | Present gameplay information and submit player intent through existing gameplay interfaces. |

Keep pure calculations and rules testable without a scene or browser. Let Phaser adapters connect those rules to input, rendering, and collision handling. Arcade Physics is the initial intended collision approach; do not assume its configuration already exists.

Prefer reusable data definitions for items, resources, enemies, and recipes, with behavior composed where needed. Avoid a class for every item, deep hierarchies, mandatory ECS, or speculative shared packages. Add modules when an implemented feature benefits from them.

## Deterministic generation

- `world/worldConfig.ts` defines the current generator version and seed. Pure biome, object, river, and lake generation lives in `world/terrain.ts`, `world/worldObjects.ts`, `world/river.ts`, and `world/lake.ts`, using salted coordinate hashes from `world/worldHash.ts`. `world/surface.ts` combines water features. `world/objectFrames.ts` maps generated object types to atlas frames and collision sizes.
- `world/chunk.ts` owns global tile and chunk coordinates; `world/ChunkManager.ts` manages the nearby window independently of Phaser. `world/renderChunk.ts` creates and releases Phaser layers, sprites, and colliders.
- `world/animals.ts` generates groups of cows and chickens per chunk and advances their land-only movement. `world/AnimalDisplay.ts` owns their Phaser sprites and keeps animal state in memory when chunks unload.
- Tiles are 16 pixels, chunks are 32 by 32 tiles, and the active window is 3 by 3 chunks. The spawn is the center of global tile (0, 0).
- For a fixed generator version and configuration, the same seed must reconstruct the same initial world and caves.
- Derive generation randomness from stable inputs such as seed, chunk coordinates, cave identity, and depth. Do not depend on wall-clock time or unseeded randomness.
- Generate each chunk consistently regardless of visitation or loading order. Use stable spatial rules for features spanning chunk boundaries.
- Separate generated terrain from subsequent player modifications. Loading or regenerating a chunk must not restore collected resources or erase changes.
- Keep generation logic separate from rendering so reproducibility can be tested directly.

## Persistence and multiplayer readiness

Prefer serializable gameplay state over storing Phaser objects. Reconstruct initial terrain from the seed and apply saved modifications; retain inventory, containers, constructions, farming, relevant entities, time, and progression as those features arrive.

When persistence is implemented, record enough generator and save-format information to detect incompatible saves. Do not silently reinterpret an old world using changed generation rules. Select storage and compatibility behavior in that feature's plan, not in this harness.

Future cooperative multiplayer should use an authoritative server that validates actions and synchronizes shared state. Keep rules reusable between singleplayer and server simulation where practical. Do not create networking, server packages, database integrations, or synchronization abstractions before their milestones require them.
