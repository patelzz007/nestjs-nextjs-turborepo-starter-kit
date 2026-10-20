/**
 * Resolves the tenant a signed-in member reaches through an `:tenantSlug` route segment (owned by
 * tenants). A non-member is answered exactly like a missing tenant (404), so the route is
 * not an oracle for which tenants exist.
 */
export interface MerchantTenantResolverPort {
	tenantIdForMember(userId: string, tenantSlug: string): Promise<string>;
}

export const MERCHANT_TENANT_RESOLVER = Symbol("MERCHANT_TENANT_RESOLVER");
