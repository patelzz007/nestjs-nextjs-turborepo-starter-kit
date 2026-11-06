import { toolingConfig } from "../../../../tooling.config.ts";
import { ToolingConfigSchema, type ToolingConfig } from "./tooling-config-schema.ts";

/** The repository's settings, checked when a tool starts: a bad `tooling.config.ts` stops it with a named error. */
export const settings: ToolingConfig = ToolingConfigSchema.parse(toolingConfig);
