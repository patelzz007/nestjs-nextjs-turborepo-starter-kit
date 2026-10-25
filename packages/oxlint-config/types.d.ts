/**
 * Option shapes shared by this package's declarations. The configs are written
 * in JavaScript (oxlint loads them directly); these declarations give the
 * TypeScript workspaces that compose them (their `oxlint.config.ts` and lint
 * canaries) real types. `__tests__/declarations.test.js` keeps every
 * declaration file in step with its module's runtime exports.
 */

/** One `workspace/restricted-imports` pattern (ESLint's `no-restricted-imports` `patterns` entry, `regex` form). */
export interface RestrictedImportPattern {
	readonly regex: string;
	readonly message: string;
	readonly caseSensitive?: boolean;
}

/** One `no-restricted-globals` entry. */
export interface RestrictedGlobal {
	readonly name: string;
	readonly message: string;
}

/** One `workspace/restricted-syntax` entry: an esquery selector and why it is banned. */
export interface RestrictedSyntaxOption {
	readonly selector: string;
	readonly message: string;
}

type NamingFormat = "camelCase" | "strictCamelCase" | "PascalCase" | "StrictPascalCase" | "snake_case" | "UPPER_CASE";
type UnderscoreOption = "forbid" | "allow" | "require" | "requireDouble" | "allowDouble" | "allowSingleOrDouble";
interface NamingMatch {
	readonly regex: string;
	readonly match: boolean;
}

/** One `workspace/naming-convention` option (the @typescript-eslint/naming-convention shape, without `types`). */
export interface NamingConventionOption {
	readonly selector: string | readonly string[];
	readonly format: readonly NamingFormat[] | null;
	readonly modifiers?: readonly string[];
	readonly leadingUnderscore?: UnderscoreOption;
	readonly trailingUnderscore?: UnderscoreOption;
	readonly prefix?: readonly string[];
	readonly suffix?: readonly string[];
	readonly filter?: string | NamingMatch;
	readonly custom?: NamingMatch;
}
