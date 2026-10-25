import type { OxlintOverride } from "oxlint";

import type { RestrictedGlobal, RestrictedImportPattern } from "./types.js";

export declare const UNIVERSAL_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const FRONTEND_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const BACKEND_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const API_CLIENT_PORTABLE_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const API_CLIENT_CORE_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const API_CLIENT_RESTRICTED_GLOBALS: RestrictedGlobal[];
export declare const MOBILE_RESTRICTED_IMPORT_PATTERNS: RestrictedImportPattern[];
export declare const MOBILE_RESTRICTED_GLOBALS: RestrictedGlobal[];
/** The API's bounded contexts (apps/api/src/contexts/*). */
export declare const DDD_CONTEXTS: string[];
export declare const universalImportBoundaryConfig: OxlintOverride;
export declare const frontendImportBoundaryConfig: OxlintOverride;
export declare const backendImportBoundaryConfig: OxlintOverride;
export declare const mobileImportBoundaryConfig: OxlintOverride;
export declare const apiClientBoundaryConfigs: OxlintOverride[];
export declare const apiArchitectureBoundaryConfigs: OxlintOverride[];
export declare const frontendContextBoundaryConfigs: OxlintOverride[];
export declare const mobileContextBoundaryConfigs: OxlintOverride[];
