# Code Style

## Naming and formatting

- Use English for all code identifiers and descriptive names that explain purpose.
- Use PascalCase for classes, interfaces, and types.
- Use camelCase for variables, functions, and methods.
- Use UPPER_SNAKE_CASE for named constants representing fixed configuration or domain values; ordinary local `const` bindings remain camelCase.
- Replace meaningful magic values with named constants.
- Follow formatting in the surrounding code. The template generally uses four-space indentation and single-quoted strings; do not reformat unrelated sections.
- Do not add code comments. Express intent through names, types, and focused functions; put necessary explanations in documentation.
- Existing template comments and naming inconsistencies do not justify unrelated cleanup.

## TypeScript and design

- Preserve the project's strict TypeScript settings.
- Prefer precise types and interfaces; avoid `any` unless strictly necessary.
- Narrow values instead of relying on unnecessary assertions or non-null assertions.
- Remove imports and variables made unused by the current change.
- Keep functions small and focused on one responsibility.
- Prefer composition over complex inheritance; extending Phaser Scene is appropriate for scene integration.
- Avoid circular dependencies and keep module dependencies explicit.
- Follow the responsibility boundaries in [architecture.md](architecture.md).

## Phaser lifecycle and performance

- Respect `init`, `preload`, `create`, and `update` responsibilities. Load assets before using them.
- Release owned subscriptions, timers, and external resources at the appropriate scene shutdown or destruction boundary. Avoid duplicate listeners when scenes restart.
- Keep per-frame work focused. Avoid unnecessary allocations, repeated resource creation, and expensive searches inside update loops.
- Use elapsed time for time-dependent behavior rather than assuming a particular frame rate.
- Optimize measured or concrete hot paths without introducing speculative pooling or framework machinery.
