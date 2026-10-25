import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/** apps/docs: base rules; the Astro build output and generated types are not source. */
export default composeConfigs(baseConfig, {
	ignorePatterns: ["dist/**", ".astro/**"],
});
