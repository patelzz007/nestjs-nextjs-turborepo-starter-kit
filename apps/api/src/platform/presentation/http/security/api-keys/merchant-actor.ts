import type { TenantApiKeyScope } from "@workspace/shared";

/** A signed-in tenant member calling a merchant dashboard route. */
export interface MerchantUserActor {
	readonly kind: "user";
	readonly userId: string;
	readonly tenantId: string;
	/** The route key (slug or id) the member's membership was resolved through. */
	readonly tenantSlug: string;
}

/** A merchant API key calling a tenant route machine-to-machine. */
export interface MerchantApiKeyActor {
	readonly kind: "api_key";
	readonly tenantId: string;
	readonly apiKeyId: string;
	readonly keyScope: TenantApiKeyScope;
	/** The store the key is limited to; `null` for a tenant-wide key. */
	readonly keyLocationId: string | null;
}

/** Resolved tenant actor for merchant dashboard and machine-to-machine routes. */
export type MerchantActor = MerchantUserActor | MerchantApiKeyActor;

export const MERCHANT_ACTOR_KEY = "merchantActor";
