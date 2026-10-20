/** Tenant facts another context reads inside its own transaction (support access, for one). */
export interface TenantExistencePort {
	/** A live (not soft-deleted) tenant. */
	exists(tenantId: string): Promise<boolean>;
	/** An ACTIVE, non-deleted OWNER membership on a live, active account. */
	isActiveOwner(tenantId: string, userId: string): Promise<boolean>;
}
