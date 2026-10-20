import type { SystemOperationName } from "./system-operation-names";

// System operations more than one bounded context (or the platform and a context) run under, named once
// here so every route decorator and adapter imports the same constant. An operation one context owns is
// named in that context's `application/ports/*.tokens.ts` instead.

/** Reads of a principal's own identity, grants and session state (guards, authorization checks, sign-in steps). */
export const PRINCIPAL_LOOKUP_OPERATION: SystemOperationName = "auth.principal.lookup";

/** The `auth.membership.lookup` system operation, named once for every route and adapter that runs under it. */
export const AUTH_MEMBERSHIP_LOOKUP_OPERATION: SystemOperationName = "auth.membership.lookup";

/** The `files.authorization` system operation, named once for every route and adapter that runs under it. */
export const FILES_AUTHORIZATION_OPERATION: SystemOperationName = "files.authorization";

/** Reads an approved support grant: the authorization kernel (verify a request) and identity (start impersonation). */
export const SUPPORT_ACCESS_VERIFY_OPERATION: SystemOperationName = "support_access.verify";
