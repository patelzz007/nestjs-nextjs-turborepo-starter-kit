import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * Design token package ESLint configuration — the shared base rules, unchanged.
 *
 * @type {import("eslint").Linter.Config}
 */
const config = [...baseConfig];

export default config;
