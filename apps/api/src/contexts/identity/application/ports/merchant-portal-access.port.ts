/** What the merchant portal sign-in needs to know about an account (tenants data). */
export interface MerchantPortalAccess {
	/** Slug of the account's oldest active merchant membership, or `null`. */
	readonly tenantSlug: string | null;
	/** An unexpired, pending team invitation exists for the address. */
	readonly hasPendingTeamInvite: boolean;
}

/** Read by the session issuer for client type `merchant`. Owned by tenants. */
export interface MerchantPortalAccessPort {
	findAccess(userId: string, email: string, now: number): Promise<MerchantPortalAccess>;
}
