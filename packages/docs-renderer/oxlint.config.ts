import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/** packages/docs-renderer: base rules (it renders React to static markup but ships no components of its own). */
export default composeConfigs(baseConfig, {});
