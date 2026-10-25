import type { OxlintConfig, OxlintOverride } from "oxlint";

/** The approved rule exceptions: each a single file and the exact rules it may break. */
export declare const approvedRuleExceptions: OxlintOverride[];
/** Turns on the client-only widget allowlist (decision #58) with the given widgets. */
export declare function clientOnlyWidgetsConfig(widgets: readonly string[]): OxlintOverride;
/** The React library config: base, React / Hooks / Compiler, DOM accessibility and the frontend boundaries. */
export declare const config: OxlintConfig;
