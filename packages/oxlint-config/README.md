# `@workspace/oxlint-config`

The shared Oxlint configuration for the workspace, and the repository's own lint rules.

- **Entry points** (see `package.json#exports`, each with a `.d.ts`): `base`, `react-internal`, `next-js`, `react-native`, `nestjs`, `import-boundaries`, `plugin`, `compose`, `testing`.
- **Compose, never extend.** A workspace's `oxlint.config.ts` is `composeConfigs(sharedConfig, { …its own blocks })`. Oxlint's `extends` drops `env`, `globals`, `settings` and `ignorePatterns`; `compose.js` merges them explicitly and rejects `extends`.
- **The rule set** is the explicit lists in `rules/*.js` (every category is off, every rule an `error`). `restricted-syntax-rules.js` holds the esquery bans (casts, `unknown` / `never`, runtime `typeof`, `[0]`, tenancy naming); `import-boundaries.js` the import and global boundaries.
- **`plugin/`** is the `workspace` JS plugin: `restricted-imports`, `restricted-syntax`, `naming-convention`, `ssr-false-allowlist`, `no-server-import-in-client-component`. `js-plugins.js` says where every ESLint-API plugin is loaded from and under which name.
- **`testing.js`** (`lintAsIf`, `ruleIdsFor`, `ruleMessagesFor`, `isolatedConfig`) lints snippets with the real `oxlint` binary in a temp directory — the workspaces' lint canaries use it.
- **Tests** in `__tests__/`: a `RuleTester` suite per repository rule, the compose rules, the presets and the declarations.

Full documentation: [`docs/technical/tooling/oxlint.md`](../../docs/technical/tooling/oxlint.md), including section 3.1 "Import boundaries"; the decision: [ADR 063](../../docs/adr/063-oxlint-oxfmt-typescript-7-and-tsrs.md).
