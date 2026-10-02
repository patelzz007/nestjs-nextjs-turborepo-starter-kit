# `@workspace/eslint-config`

Shared eslint configuration for the workspace.

- `base.js`, `next.js`, `react-internal.js`, `nestjs.js` are the entry points (see `package.json#exports`).
- `import-boundaries.js` holds the import-boundary patterns and the local `workspace-boundaries` rule used by `base.js` (universal) and `next.js` / `react-internal.js` (frontend).

Full documentation: [`docs/eslint.md`](../../docs/eslint.md), including section 3.1 "Import boundaries".
