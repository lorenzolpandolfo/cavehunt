# Development Roadmap

The Foundation tasks F1–F5 are implemented. All other tasks below are planned. The current application is described in [architecture](../.agents/architecture.md); gameplay intent lives in [game design](../.agents/game-design.md).

Each row is a focused delivery with an observable acceptance criterion. Dependencies refer to task IDs and are prerequisites, not permission to implement additional tasks. Implement only the requested scope. Mark completion only after implementation and applicable [validation](../.agents/testing.md).

## Delivery milestones

- **First playable world:** F1–F5, W1–W5, W7, and R1–R3. Walk through a procedural forest, gather resources, and discover cave entrances; entering a generated cave is a later delivery.
- **Initial MVP:** the first playable world plus S4 and P0a–P0c. Add a basic day/night cycle and save/load seed, player state, inventory, collected resources, and world time.
- Rivers, crafting, hostile waves, and deeper systems can follow independently according to the dependencies below.

## 1. Foundation

| ID | Delivery | Depends on | Acceptance | Status |
| --- | --- | --- | --- | --- |
| F1 | Display a controllable character's initial representation in the game scene | Template | Character appears at a defined spawn point. | Done |
| F2 | Eight-direction input and movement | F1 | Cardinal and diagonal movement have equal speed and stop when input ends. | Done |
| F3 | Following camera | F2 | Camera follows movement without losing the player. | Done |
| F4 | Basic traversable terrain | F1 | A small terrain map renders with explicit walkable and blocked areas. | Done |
| F5 | Obstacle collisions | F2, F4 | Player cannot pass through blocked terrain or placed obstacles. | Done |

## 2. Procedural world

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| W1 | Seeded terrain generation | F4 | Repeated generation with fixed inputs produces identical terrain data. |
| W2 | World/chunk coordinate mapping and chunk generation | W1 | Positive and negative positions map consistently; generation order does not change contents. |
| W3 | Chunk loading and unloading | W2, F3, F5 | Moving across boundaries loads nearby terrain with collisions and releases distant chunks. |
| W4 | Initial forest and plain biome distribution | W2 | Both terrain types appear under reproducible distribution rules. |
| W5 | Trees, rocks, and vegetation | W3, W4 | Seeded objects appear consistently with appropriate blocking behavior. |
| W6 | Rivers and water terrain | W4, W3 | Water features remain continuous across chunk boundaries. |
| W7 | Discoverable cave entrances | W5 | Valid, reproducible entrance locations are visible and reachable. |

## 3. Resource collection

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| R1 | Target selection and basic tool interaction | F2, W5 | Player can select an in-range gathering target; distant targets are rejected. |
| R2 | Minimal item definitions and inventory | F1 | Resources can be added and displayed with consistent stack counts. |
| R3 | Gather wood and stone with depletion | R1, R2, W3 | Gathering adds resources; depleted objects stay depleted after chunk reload. |
| R4 | Basic recipe crafting | R3 | Crafting consumes available ingredients and produces the defined output; insufficient ingredients prevent crafting. |

## 4. Survival

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| S1 | Player health and damage | F1 | Damage changes health within bounds and exposes a defeated state. |
| S2 | Basic weapon attack | S1, F2 | An attack damages an in-range damageable target once per intended hit. |
| S3 | One hostile enemy | S2, F5 | Enemy pursues the player, respects collisions, and can deal and receive damage. |
| S4 | Basic day/night clock and presentation | W3 | Time advances through a complete cycle with distinguishable day and night. |
| S5 | Nighttime waves | S3, S4 | Waves spawn at night and become harder through an explicit progression rule. |

## Early persistence: initial MVP

These tasks are introduced before full persistence. Choose the storage implementation when this feature is planned; no database or storage dependency is prescribed here.

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| P0a | Serializable MVP world snapshot | R3, S4, W7 | Snapshot captures seed, generator/save version, player state, inventory, collected-resource changes, and time without Phaser objects. |
| P0b | Local save/load and world reconstruction | P0a | Reload restores the snapshot over seeded terrain, including depletion and time. |
| P0c | Save failure and compatibility handling | P0b | Missing, malformed, or unsupported saves produce a clear outcome without silently replacing valid progress. |

## 5. Cave exploration

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| C1 | Seeded cave rooms and corridors | W2 | A cave identity and depth reproduce connected, traversable rooms. |
| C2 | Enter and leave caves | C1, W7, F5 | Entrance transitions to the cave and exit returns to its surface entrance. |
| C3 | Cave minerals and mining | C2, R3 | Minerals yield inventory resources and remain depleted when revisited during play. |
| C4 | Cave enemy spawning | C2, S3 | Cave encounters operate independently of surface night waves. |
| C5 | Treasure containers | C2, R2 | Loot can be collected once and container state survives revisiting during play. |
| C6 | Deeper cave connections | C3, C4, C5 | Deeper levels are reachable where generated and offer different resources and stronger threats. |

## 6. Construction

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| B1 | Grid placement with resource cost | R3, F5 | Valid placement consumes materials; occupied or invalid locations are rejected. |
| B2 | Walls and floors | B1 | Placed walls block movement and floors provide traversable surfaces. |
| B3 | Doors | B2 | Opening and closing a door updates passage consistently. |
| B4 | Storage containers | B1, R2 | Items transfer between player inventory and a placed container without duplication. |
| B5 | Workbench recipes | B1, R4 | A placed workbench enables its recipes under the intended interaction conditions. |
| B6 | Furnace processing | B5, C3 | Furnace consumes defined inputs and yields processed material. |
| B7 | Damageable structures and base defense | B2, B3, S5 | Night enemies can damage structures; a basic defensive structure helps protect the base. |

## 7. Progression

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| G1 | Equipment slots and bonuses | R2, S2 | Equipping and removing an item consistently updates its gameplay effects. |
| G2 | Armor station and recipes | G1, B5, B6 | Station produces usable armor from the required ingredients. |
| G3 | Research station and unlocks | B5, C5 | Research consumes its requirements and makes an initially locked recipe available. |
| G4 | Magic table and one spell | G3, G1, S2 | A researched magical item enables one usable spell with defined costs and effects. |
| G5 | Farming soil, planting, and growth | B1, R2, S4 | A planted seed advances through defined growth stages. |
| G6 | Water-influenced growth and harvest | G5, W6 | Water proximity affects moisture; mature crops yield inventory items when harvested. |

## 8. Full persistence

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| P1 | Save cave modifications and loot state | P0c, C6 | Loading preserves cave depletion, opened containers, and depth progress. |
| P2 | Save constructions, storage, and station state | P0c, B4, B6, B7 | Loading restores placed structures, contents, damage, and active processing state. |
| P3 | Save equipment, research, and farming | P0c, G2, G3, G4, G6 | Loading restores unlocks, equipment effects, crops, and moisture state. |
| P4 | Full-world save compatibility and round-trip validation | P1, P2, P3 | Supported saves restore all implemented persistent state; unsupported formats are handled explicitly. |

## 9. Multiplayer

Plan networking architecture when entering this phase. An authoritative server is the intended direction; Node.js, TypeScript, and Colyseus are candidates, not installed infrastructure.

| ID | Delivery | Depends on | Acceptance |
| --- | --- | --- | --- |
| M1 | Server simulation boundary | P4 | Core rules can execute without Phaser rendering and be reused by a server. |
| M2 | Cooperative world session | M1 | Two clients can join and leave the same authoritative world. |
| M3 | Player movement synchronization | M2 | Clients observe one another moving; the server validates movement. |
| M4 | Combat and enemy synchronization | M3 | Clients observe consistent authoritative damage and enemy state. |
| M5 | Gathering, inventory, and terrain synchronization | M3 | Concurrent collection does not duplicate resources or diverge world state. |
| M6 | Building and progression synchronization | M5 | Structures, stations, research, and crops remain consistent across clients. |
| M7 | Shared cave exploration | M4, M5 | Players can traverse surface and cave levels while observing consistent relevant state. |
| M8 | Persistent shared worlds and reconnect | M6, M7 | Rejoining restores authoritative world and player progress without duplicating items. |

Additional biomes, enemy varieties, bosses, advanced crafting, magic, and irrigation remain future design opportunities. Define their own bounded tasks when requested rather than expanding these foundation deliveries automatically.
