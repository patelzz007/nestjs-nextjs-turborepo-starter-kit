import type { TenantLogoResponse } from "@workspace/shared";

/** What other contexts show about a tenant. */
export interface TenantDisplayData {
	readonly tenantId: string;
	readonly slug: string;
	readonly displayName: string;
	/** IANA zone the tenant's analytics are cut in. */
	readonly timeZone: string;
	/** The live store logo with its image sources, or `null` (clients show a monogram). */
	readonly logo: TenantLogoResponse | null;
}

/**
 * Batched tenant reads for other contexts (one query per call, never
 * per id). The caller has already authorized the records that reference
 * these tenants; ids that are not live tenants are absent.
 */
export interface TenantReadPort {
	getDisplayData(tenantIds: readonly string[]): Promise<ReadonlyMap<string, TenantDisplayData>>;
	/** User ids of the tenant's live ACTIVE owners (owner notifications). */
	listOwnerUserIds(tenantId: string): Promise<readonly string[]>;
}
