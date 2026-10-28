import type { OxlintConfig } from "oxlint";

/**
 * The resolved config type, re-exported so every workspace's `oxlint.config.ts` can name the type of
 * what it exports through this package (TypeScript 7.1 refuses a declaration it can only name through
 * another package's private `node_modules` path — TS2883).
 */
export type { OxlintConfig };

/** Composes oxlint configs into one resolved config, instead of oxlint's `extends` (see compose.js). */
export declare function composeConfigs(...configs: readonly OxlintConfig[]): OxlintConfig;
