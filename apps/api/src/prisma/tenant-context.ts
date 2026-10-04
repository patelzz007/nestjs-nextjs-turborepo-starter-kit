import type { SystemOperation } from "./system-operation.registry";

/** Tenant database session context — set transaction-locally in PostgreSQL. */
export interface TenantDatabaseContext {
	readonly userId: string;
	readonly organizationId: string;
	readonly purpose: string;
	readonly policyVersion: number;
}

/**
 * Allowlisted system operation bypassing tenant scope.
 *
 * There is deliberately no correlation id here: `TenantTransactionService`
 * takes it from the request context (ADR 017) — or generates one for work
 * outside a request — so a caller can never stamp a made-up id on the audit
 * trail.
 */
export interface SystemDatabaseContext {
	readonly operation: SystemOperation;
	readonly reason: string;
	readonly actorUserId: string | null;
}
