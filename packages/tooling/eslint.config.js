import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * Repo-wide Node scripts (plain ESM). The base config gives `*.mjs` files the
 * Node globals; the TypeScript-only rules do not apply to them.
 *
 * @type {import("eslint").Linter.Config}
 */
export default [...baseConfig];
