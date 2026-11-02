/** One of a tenant's customers as its merchants may see them: a name and a masked email, never the address. */
export interface TenantCustomerSummary {
	readonly userId: string;
	readonly fullName: string;
	readonly maskedEmail: string | null;
	readonly lastClaimedAt: number;
	readonly claimCount: number;
}

/** One page of a tenant's customers, newest claim (or most claims) first. */
export interface TenantCustomerPageRequest {
	/** Matches the name or the email, case-insensitively. */
	readonly search: string | null;
	readonly sortField: "lastClaimedAt" | "claimCount";
	readonly descending: boolean;
	readonly page: number;
	readonly limit: number;
}

export interface TenantCustomerPage {
	readonly items: readonly TenantCustomerSummary[];
	readonly total: number;
}

/**
 * The tenant-customer link (ADR 073), bound to the producing transaction: a person's claim of a tenant's
 * reward creates or refreshes it (and brings them back if they had left), a redemption stamps it. A POS
 * sale never creates one: a sale has no user. Merchants read the links to give a reward to chosen
 * customers; reading names and emails (`page`, `summaries`) needs an operation that may read `User`.
 */
export interface TenantCustomerLinksPort {
	/** First claim: creates the link; later claims count up and clear `leftAt`. Safe under concurrent claims (one row per tenant and user). */
	recordClaim(tenantId: string, userId: string, claimedAt: number): Promise<void>;
	/** Stamps `lastRedeemedAt` on an existing link (a redemption always follows a claim). */
	recordRedemption(tenantId: string, userId: string, redeemedAt: number): Promise<void>;
	/** Which of `userIds` are live customers of the tenant (each once). */
	customersAmong(tenantId: string, userIds: readonly string[]): Promise<readonly string[]>;
	/** The named customers of the tenant, in the order asked (anyone who is not a live customer is left out). */
	summaries(tenantId: string, userIds: readonly string[]): Promise<readonly TenantCustomerSummary[]>;
	/** One page of the tenant's customers. */
	page(tenantId: string, request: TenantCustomerPageRequest): Promise<TenantCustomerPage>;
}
