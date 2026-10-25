import { composeConfigs } from "./compose.js";

import { config as baseConfig } from "./base.js";

/** packages/oxlint-config lints itself with the base rules (its files are Node ESM). */
export default composeConfigs(baseConfig, {
	env: { node: true },
});
