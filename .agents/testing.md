# Testing and Validation

## Current commands

Run application commands from the repository's `cavehunt/` subdirectory, where `package.json` and the installed dependencies live.

| Check | Command | Purpose |
| --- | --- | --- |
| TypeScript | `./node_modules/.bin/tsc --noEmit` | Check source types without emitting files. |
| Unit tests | `npm test` | Run deterministic movement, biome, object, river, lake, coordinate, and chunk management checks with Node's built-in test runner. |
| Production build | `npm run build-nolog` | Verify Vite bundling using the existing script without template telemetry. |

There is currently no lint script. Vite builds do not replace the separate TypeScript check. Inspect the current scripts when working on a task, and run applicable existing tests.

## Match validation to the change

- For source changes, run TypeScript and production build checks, plus relevant tests that exist.
- For rendering, input, camera, collision, or UI changes, inspect the relevant code and run applicable automated checks. Playing the game or manually testing it in a browser is optional and only needed when explicitly requested.
- For documentation-only changes, inspect paths, links, command accuracy, consistency, and whitespace. A gameplay test suite or build is not required solely for prose changes.
- Run `git diff --check` from the repository root. Check new untracked documents separately because they are absent from the normal diff.
- Fix failures caused by the change. Report pre-existing failures or unavailable checks clearly, with the command and reason.
- Never claim a check passed unless it was actually executed. Distinguish automated results from code-based expectations.

## Future gameplay tests

Prioritize deterministic unit tests of pure gameplay rules, separate from Phaser rendering where practical. Add a testing framework only when an implemented behavior creates a concrete testing need; do not install one for this harness.

Relevant examples, as the features arrive:

- Movement calculations keep diagonal and cardinal speed equivalent.
- Cave generation is reproducible for the same cave identity and depth.
- Gathering updates resources and inventory correctly, including depleted targets.
- Saved state restores player modifications over the generated world without respawning collected resources.
- Time, crafting, combat, and progression rules respect their intended boundaries.

Keep fixtures controlled and assertions about behavior rather than implementation details. Where practical, cover scene integration, restarts, and resource cleanup with automated tests or code inspection.
