import type { OxlintConfig } from "oxlint";

/** Composes oxlint configs into one resolved config, instead of oxlint's `extends` (see compose.js). */
export declare function composeConfigs(...configs: readonly OxlintConfig[]): OxlintConfig;
