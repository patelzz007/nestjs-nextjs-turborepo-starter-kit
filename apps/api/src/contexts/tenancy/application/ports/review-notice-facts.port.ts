/** What a reward-review notice to a tenant's owners needs about the tenant. */
export interface ReviewNoticeFacts {
	/** The tenant's slug, for the merchant link in the notice. */
	readonly slug: string;
	/** The tenant's live ACTIVE owners: who is told. */
	readonly ownerUserIds: readonly string[];
}

/**
 * The tenant facts a review notice needs, read on the caller's unit-of-work transaction (the review decision's).
 * Reading them in that same transaction (not through `TENANT_READ`, a system operation of its own) keeps a
 * decision to one pooled connection: a nested transaction held a second one while the first waited.
 */
export interface ReviewNoticeFactsPort {
	/** The tenant's slug and owners; `null` for a tenant that is not live. */
	reviewNoticeFacts(tenantId: string): Promise<ReviewNoticeFacts | null>;
}
