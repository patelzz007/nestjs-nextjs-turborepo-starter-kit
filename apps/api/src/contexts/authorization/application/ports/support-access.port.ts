/**
 * The tenant facts support access depends on. Tenants owns these rows and implements this
 * through its transactional `existence` port (bound to authorization's transaction by the scope factory).
 */
export interface SupportAccessTenantReader {
	/** A live (not soft-deleted) tenant. */
	exists(tenantId: string): Promise<boolean>;
	/** An ACTIVE, non-deleted OWNER membership on a live, active account. */
	isActiveOwner(tenantId: string, userId: string): Promise<boolean>;
}

/** One tenant audit row, written in the caller's transaction with the real actor and the active policy version. */
export interface TenantAuditRecord {
	readonly tenantId: string;
	readonly actorUserId: string;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly decision?: "Allow";
	/** Client-safe scalars only. */
	readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface TenantAuditWriter {
	record(entry: TenantAuditRecord): Promise<void>;
}
