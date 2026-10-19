/**
 * Resolves the organization a signed-in member reaches through an `:orgSlug` route segment (owned by
 * organizations). A non-member is answered exactly like a missing organization (404), so the route is
 * not an oracle for which organizations exist.
 */
export interface MerchantOrganizationResolverPort {
	organizationIdForMember(userId: string, orgSlug: string): Promise<string>;
}

export const MERCHANT_ORGANIZATION_RESOLVER = Symbol("MERCHANT_ORGANIZATION_RESOLVER");
