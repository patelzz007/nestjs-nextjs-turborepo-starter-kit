/**
 * The organization facts support access depends on. Organizations owns these rows and implements this
 * through its transactional `existence` port (bound to authorization's transaction by the scope factory).
 */
export interface SupportAccessOrganizationReader {
	/** A live (not soft-deleted) organization. */
	exists(organizationId: string): Promise<boolean>;
	/** An ACTIVE, non-deleted OWNER membership on a live, active account. */
	isActiveOwner(organizationId: string, userId: string): Promise<boolean>;
}

/** One organization audit row, written in the caller's transaction with the real actor and the active policy version. */
export interface OrganizationAuditRecord {
	readonly organizationId: string;
	readonly actorUserId: string;
	readonly policyVersion: number;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly decision?: "Allow";
	/** Client-safe scalars only. */
	readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface OrganizationAuditWriter {
	record(entry: OrganizationAuditRecord): Promise<void>;
}
