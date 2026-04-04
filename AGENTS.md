# Repository Guidelines

## Project Structure & Module Organization
`src/client/` contains the React 19 + Vite UI. Keep feature UI in `components/`, shared client logic in `hooks/`, `lib/`, and `store.ts`, and API wiring in `api/client.ts`. `src/server/` contains the Bun + Elysia backend: `routes/` defines HTTP endpoints, `adapters/` fetch schema metadata from supported databases, and `storage/` manages persisted connections, groups, workspaces, and snapshots. Shared types live in `src/types.ts`. Planning notes are kept in `docs/superpowers/plans/`. Treat `dist/` as generated output.

## Build, Test, and Development Commands
Use Bun for all local workflows:

- `bun run dev` starts the watched server and Vite client together.
- `bun run dev:server` runs the API server on port `3777`.
- `bun run dev:client` starts the frontend dev server with `/api` proxied to the backend.
- `bun run build` creates the production client bundle in `dist/`.
- `bun test` runs the full test suite with Bun's test runner.

## Coding Style & Naming Conventions
This repo uses strict TypeScript and ES module imports. Follow the existing style: 2-space indentation, semicolon-free files, single quotes, and small focused functions. Use `PascalCase` for React components (`SchemaDiffModal.tsx`), `camelCase` for utilities and hooks (`useSelectionContext.ts`), and `kebab-case` for CSS module filenames paired with components only when already established. Prefer colocated `*.module.css` files for component styling and keep shared domain types in `src/types.ts`.

## Testing Guidelines
Tests use `bun:test`. Place tests beside the code they cover using `*.test.ts` names, for example `src/client/lib/schema-diff.test.ts` and `src/server/adapters/sqlite.test.ts`. Add coverage for pure client helpers, adapter behavior, and storage/config flows when changing those areas. Run `bun test` before opening a PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative, feature-focused subjects such as `Add sidebar reordering and workspace save as` or `fix stale ref bug fix canvas node rerender bug`. Keep commits narrowly scoped and descriptive. PRs should explain the user-visible change, note any config or schema impacts, link related issues, and include screenshots or short recordings for UI work. Always mention the commands you ran to verify the change.

## Configuration Tips
Local state is stored in `schemaboard.config.json` and `schemaboard.db`. Do not commit secrets or real connection strings; use sanitized examples when updating fixtures or docs.
