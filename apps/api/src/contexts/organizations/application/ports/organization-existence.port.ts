/** Organization facts another context reads inside its own transaction (support access, for one). */
export interface OrganizationExistencePort {
	/** A live (not soft-deleted) organization. */
	exists(organizationId: string): Promise<boolean>;
	/** An ACTIVE, non-deleted OWNER membership on a live, active account. */
	isActiveOwner(organizationId: string, userId: string): Promise<boolean>;
}
