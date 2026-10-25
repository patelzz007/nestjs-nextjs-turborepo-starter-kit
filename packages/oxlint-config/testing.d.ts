import type { OxlintConfig } from "oxlint";

/** One diagnostic: the rule id (`workspace/restricted-imports`, `no-console`) and its message. */
export interface LintReport {
	readonly ruleId: string;
	readonly message: string;
}

/** Lints each snippet as if it were the workspace file at its key (see testing.js). */
export declare function lintAsIf(config: OxlintConfig, files: Readonly<Record<string, string>>): Record<string, LintReport[]>;
/** The rule ids reported for one snippet. */
export declare function ruleIdsFor(config: OxlintConfig, code: string, relativePath: string): string[];
/** The messages one rule reports for one snippet. */
export declare function ruleMessagesFor(config: OxlintConfig, code: string, relativePath: string, rule: string): string[];
/** A config running ONLY what `extra` sets (every category off). */
export declare function isolatedConfig(extra: OxlintConfig): OxlintConfig;
