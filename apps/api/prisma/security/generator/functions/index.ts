import type { SecurityFunction } from "../security-function";
import { ACCESS_MODEL_FUNCTIONS } from "./access-model";
import { ACCOUNT_ERASURE_FUNCTIONS } from "./account-erasure";
import { API_KEY_FUNCTIONS } from "./api-key";
import { AUDIT_RETENTION_FUNCTIONS } from "./audit-retention";
import { MEMBERSHIP_FUNCTIONS } from "./membership";
import { REWARD_FUNCTIONS } from "./rewards";
import { SESSION_FUNCTIONS } from "./session";
import { TRIGGER_FUNCTIONS } from "./triggers";

/** The session primitives: defined first, every other function and policy calls them. */
export const PRIMITIVE_FUNCTIONS: readonly SecurityFunction[] = SESSION_FUNCTIONS;

/**
 * Every other function, in the order PostgreSQL needs (an SQL-language body is checked when it is created,
 * so a function it calls must already exist). `app_rls_bypass_on`, rendered from the system-operation
 * registry, comes between the primitives and these.
 */
export const BUILDING_BLOCK_FUNCTIONS: readonly SecurityFunction[] = [
	...MEMBERSHIP_FUNCTIONS,
	...ACCESS_MODEL_FUNCTIONS,
	...REWARD_FUNCTIONS,
	...API_KEY_FUNCTIONS,
	...TRIGGER_FUNCTIONS,
	...AUDIT_RETENTION_FUNCTIONS,
	...ACCOUNT_ERASURE_FUNCTIONS,
];
