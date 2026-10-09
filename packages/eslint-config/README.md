# `@workspace/eslint-config`

Shared eslint configuration for the workspace.

- `base.js`, `next.js`, `react-internal.js`, `react-native.js`, `nestjs.js` are the entry points (see `package.json#exports`).
- `react-rules.js` holds the React / React Hooks blocks shared by `react-internal.js` (browser globals) and `react-native.js` (React Native globals, `eslint-plugin-react-native`, React Native accessibility selectors, mobile import boundaries — used by `apps/mobile`).
- `import-boundaries.js` holds the import-boundary patterns and the local `workspace-boundaries` rule used by `base.js` (universal) and `next.js` / `react-internal.js` (frontend).
  It also exports `apiClientBoundaryConfigs`, the portability blocks of `packages/api-client` (no Next, React-in-core, DOM-only or Node code), `mobileImportBoundaryConfig` for `apps/mobile` (no Next, react-dom, web packages, Node built-ins or AsyncStorage), and `backendImportBoundaryConfig` for the Node workspaces.

Full documentation: [`docs/technical/tooling/eslint.md`](../../docs/technical/tooling/eslint.md), including section 3.1 "Import boundaries".
