# Cavehunt Agent Guide

## Project orientation

Cavehunt is a 2D top-down survival RPG built with Phaser and TypeScript.
The Phaser client lives in `cavehunt/`, the Colyseus server in `server/`, and shared contracts in `shared/`.
Install dependencies and run workspace checks from the root; client commands still work from `cavehunt/`. See the testing guide for exact commands.
The local Foundation has evolved into a persistent online world with authoritative player movement.
Planned features in the design and roadmap are not evidence of implementation.

## Before making changes

- Read the request and inspect the relevant code, configuration, and assets.
- Check the working tree and preserve existing user changes and untracked files.
- Confirm what already exists before choosing an implementation approach.
- Read only the relevant guides from the table below.
- Resolve discoverable questions from the repository before asking the user.
- Clarify ambiguities that materially change the requested behavior or scope.

## Work at the right scale

- Implement small, well-defined, local changes directly.
- Plan broad, risky, architectural, or cross-system changes before editing.
- Break substantial work into independently implementable and verifiable steps.
- Keep each change focused on the requested outcome.
- Reuse existing systems and conventions when they fit the task.
- Prefer the simplest implementation that meets the current need.
- Introduce abstractions and dependencies only for a concrete requirement.
- Create directories and modules only when real implementation needs them.
- Consider future integration without building future systems prematurely.
- Do not implement additional roadmap tasks unless requested.
- Do not reorganize unrelated code or clean up the template opportunistically.
- Never create image assets. If a change needs an image absent from `cavehunt/public/assets/`, tell the user which asset is needed.

## Read context when relevant

| Task | Guide |
| --- | --- |
| Module boundaries, state, generation, persistence, or multiplayer | [.agents/architecture.md](.agents/architecture.md) |
| Writing or changing source code | [.agents/code-style.md](.agents/code-style.md) |
| Gameplay behavior or product intent | [.agents/game-design.md](.agents/game-design.md) |
| Choosing or running validation | [.agents/testing.md](.agents/testing.md) |
| Selecting milestones or understanding delivery dependencies | [docs/roadmap.md](docs/roadmap.md) |

Each guide owns its subject; use links instead of repeating its rules elsewhere.
Read the relevant implementation as well as the guide.

## Finish the task

- Run applicable checks and tests described in the testing guide.
- Validate from code inspection and automated checks; playing the game or manually testing it in a browser is not required unless the user explicitly asks.
- Inspect the final changes for unintended edits and incomplete behavior.
- Report what changed, what was actually checked, and any remaining limitations.
- Distinguish checks that passed from checks that failed or were not run.
- Update a guide when the change makes its existing content inaccurate.
- Mark roadmap tasks complete only after implementation and validation.
- Keep documentation in English and concise enough to maintain.
