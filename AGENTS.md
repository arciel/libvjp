# Repository Guidelines

## Project Structure & Module Organization
Keep production code inside `src/`. Use `src/index.ts` to expose public APIs and re-export helpers from `ops.ts`, `passes.ts`, `types.ts`, `util.ts`, and interpreter implementations in `src/interpreters/`. Place scenario-driven scripts such as `coro.ts` at the project root for quick manual runs. All automated tests belong in `tests/` with filenames following `*.test.ts`, mirroring the structure of the modules they cover (see `tests/coro.test.ts`). Legacy or experimental assets live under `old/`; do not import from there in new code.

## Build, Test, and Development Commands
Run `bun install` after cloning to install dependencies. Execute `bun test` to run the entire suite via `bun:test`. Use `bun test tests/coro.test.ts` when iterating on a single file, and append `--watch` for rapid feedback. Demo the staged interpreters manually with `bun run coro.ts`, which exercises the pipeline end-to-end.

## Coding Style & Naming Conventions
Author code in TypeScript (ESM). Follow four-space indentation, prefer `const`, and use explicit return types on exported functions. Employ `camelCase` for functions and variables, `PascalCase` for classes, interpreters, and exported types like `Dual`, and uppercase enums such as `Op`. Keep modules focused; new interpreters should live in `src/interpreters/` and expose a single entry point that is re-exported through `src/index.ts`.

## Testing Guidelines
The repository uses `bun:test`. Model new specs after `tests/coro.test.ts`, grouping related behaviours with `describe` and favouring top-level async tests for interpreter flows. Write companion tests whenever adding passes or interpreters, and verify both raw interpreter output and optimized forms. Ensure any regression fix includes a test named after the behaviour (e.g., `"simplify eliminates neutral elements"`).

## Commit & Pull Request Guidelines
Commits in this project are brief, action-oriented messages (see `git log` for examples like `"major refactor; with codex"`). Aim for a single responsibility per commit and include code, tests, and docs together. Pull requests should summarise the user-facing behaviour change, link to relevant issues or TODO items, and paste the exact commands used for testing (e.g., `bun test`). Provide before/after output for interpreter traces when altering staging or optimization passes.
