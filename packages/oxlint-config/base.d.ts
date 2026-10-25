import type { OxlintConfig } from "oxlint";

import type { NamingConventionOption } from "./types.js";

export declare const SOURCE_FILES: string[];
export declare const TYPESCRIPT_FILES: string[];
export declare const JAVASCRIPT_FILES: string[];
export declare const NAMING_CONVENTION: NamingConventionOption[];
/** The base config every workspace composes: TypeScript, type safety, naming, the universal import boundary. */
export declare const config: OxlintConfig;
