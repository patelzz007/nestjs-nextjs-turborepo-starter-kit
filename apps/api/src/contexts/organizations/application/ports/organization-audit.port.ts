/** Client-safe scalar metadata stored with an audit row. */
export type OrganizationAuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

/**
 * One organization audit row. Actor, organization and the policy version the
 * decision ran under are required: there is no "system" / 0 fallback, so a
 * caller that cannot name a real actor and policy version cannot write a row.
 */
export interface OrganizationAuditEntry {
	readonly organizationId: string;
	readonly actorUserId: string;
	/** Active tenant Cedar policy version the action was authorized under. */
	readonly policyVersion: number;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly decision?: string;
	readonly correlationId?: string;
	readonly metadata?: OrganizationAuditMetadata;
}

/** Appends audit rows inside one unit of work, so a row commits or rolls back with the change it describes. */
export interface OrganizationAuditWriter {
	record(entry: OrganizationAuditEntry): Promise<void>;
}

/**
 * The organization audit trail for other contexts and platform services that
 * already hold a transaction (tenant encryption, support access, files).
 * `TDb` is the caller's transaction client.
 */
export interface OrganizationAuditPort<TDb> {
	recordInTx(db: TDb, entry: OrganizationAuditEntry): Promise<void>;
}
