/**
 * Whether a customer may take a merchant's rewards, inside the caller's transaction: claims asks
 * before a claim, pos before a till redeems. A merchant that does not operate (suspended, banned,
 * not live yet) offers nothing; a customer the merchant banned takes nothing from it.
 */
export interface CustomerStandingPort {
	/** Only an ACTIVE, live tenant operates (`isTenantOperating`); false for one that does not exist. */
	tenantOperates(tenantId: string): Promise<boolean>;
	/** The customers among `customerUserIds` the tenant has an active ban on, one query for all. */
	bannedCustomers(tenantId: string, customerUserIds: readonly string[]): Promise<ReadonlySet<string>>;
}
