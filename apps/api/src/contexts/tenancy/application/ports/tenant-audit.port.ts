/** Client-safe scalar metadata stored with an audit row. */
export type TenantAuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

/**
 * One tenant audit row. Actor, tenant and the policy version the
 * decision ran under are required: there is no "system" / 0 fallback, so a
 * caller that cannot name a real actor and policy version cannot write a row.
 */
export interface TenantAuditEntry {
	readonly tenantId: string;
	readonly actorUserId: string;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly decision?: string;
	readonly correlationId?: string;
	readonly metadata?: TenantAuditMetadata;
}

/** Appends audit rows inside one unit of work, so a row commits or rolls back with the change it describes. */
export interface TenantAuditWriter {
	record(entry: TenantAuditEntry): Promise<void>;
}

/**
 * The tenant audit trail for other contexts and platform services that
 * already hold a transaction (tenant encryption, support access, files).
 * `TDb` is the caller's transaction client.
 */
export interface TenantAuditPort<TDb> {
	recordInTx(db: TDb, entry: TenantAuditEntry): Promise<void>;
}
