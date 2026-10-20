/** The tenant a merchant dashboard belongs to — what an export needs to name and title its file. */
export interface MerchantDashboardSubject {
	readonly slug: string;
	readonly displayName: string;
}

/** The tenant fields the merchant analytics read: its subject and the zone its buckets are cut in. */
export interface AnalyticsTenant extends MerchantDashboardSubject {
	readonly timeZone: string;
}

/** Tenant display data for analytics (owned by tenants; read through this port). */
export interface AnalyticsTenantReadPort {
	/** The live tenant, or `null` when it no longer exists. */
	findById(tenantId: string): Promise<AnalyticsTenant | null>;
}
