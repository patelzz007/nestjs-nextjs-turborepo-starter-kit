import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/** The UI kits' shared component logic: the base rules, nothing relaxed. */
export default composeConfigs(baseConfig, {});
