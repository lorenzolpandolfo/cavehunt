# Testing and Validation

Install dependencies with `npm ci` at the repository root using Node.js 22.18 or newer.

| Root command | Purpose |
| --- | --- |
| `npm test` | Client tests, server generation/storage/movement tests and real Colyseus integration tests. |
| `npm run typecheck` | Strict TypeScript checks for client, server and shared contracts. |
| `npm run build` | Server bundle and Vite production build without template telemetry. |
| `git diff --check` | Whitespace check for tracked changes; inspect new files separately. |

Client commands `npm test`, `npm run typecheck` and `npm run build-nolog` remain available inside `cavehunt/`. Server commands run inside `server/`. There is no lint script. Builds do not replace workspace typechecking.

## Match validation to the change

- Source changes require relevant tests, typechecking and production builds.
- Network tests use real Colyseus SDK clients, ephemeral loopback ports and temporary JSON files. If a sandbox denies socket creation, rerun the check with local-network permission.
- Validate rendering, input, camera and cleanup through source inspection and automated checks. Manual browser gameplay is optional and only required when explicitly requested.
- Documentation-only changes require paths, links, commands, consistency and whitespace checks, not gameplay tests.
- Fix failures caused by the change and report pre-existing or unavailable checks precisely. Never claim unexecuted checks passed.

## Behavioral coverage

Preserve deterministic generation and positive/negative chunk boundaries. Cover full JSON round-trips, invalid/unsupported saves, failed writes, exclusive locks, concurrent commits and movement during asynchronous saves.

Network coverage includes one room, overlapping map agreement, late join, simultaneous nickname conflicts, departure/drop cleanup, authoritative movement, stale/invalid input, recipient-specific chunk windows and restart recovery. Unit tests verify normalized speed, debug speed, swept obstacle collisions, foot geometry and stop-on-blur/hidden-tab behavior.

As mechanics arrive, add tests for inventory concurrency, persistent depletion, time progression and relevant-state synchronization. Avoid tests that merely mirror implementation details.
