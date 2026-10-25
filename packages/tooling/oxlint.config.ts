import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/** packages/tooling: the shared base rules. */
export default composeConfigs(baseConfig, {});
