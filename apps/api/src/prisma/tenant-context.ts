/** Tenant database session context — set transaction-locally in PostgreSQL. */
export interface TenantDatabaseContext {
	readonly userId: string;
	readonly organizationId: string;
	readonly purpose: string;
	readonly policyVersion: number;
}

/** Allowlisted system operation bypassing tenant scope. */
export interface SystemDatabaseContext {
	readonly operation: string;
	readonly reason: string;
	readonly correlationId: string;
	readonly actorUserId: string | null;
}

export type DatabaseAccessMode = { readonly kind: "tenant"; readonly tenant: TenantDatabaseContext } | { readonly kind: "system"; readonly system: SystemDatabaseContext };
