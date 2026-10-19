/** The organization a merchant dashboard belongs to — what an export needs to name and title its file. */
export interface MerchantDashboardSubject {
	readonly slug: string;
	readonly displayName: string;
}

/** The organization fields the merchant analytics read: its subject and the zone its buckets are cut in. */
export interface AnalyticsOrganization extends MerchantDashboardSubject {
	readonly timeZone: string;
}

/** Organization display data for analytics (owned by organizations; read through this port). */
export interface AnalyticsOrganizationReadPort {
	/** The live organization, or `null` when it no longer exists. */
	findById(organizationId: string): Promise<AnalyticsOrganization | null>;
}
