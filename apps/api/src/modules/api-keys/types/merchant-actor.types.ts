import type { OrganizationApiKeyScope } from "@workspace/shared";

/** A signed-in organization member calling a RewardHub dashboard route. */
export interface MerchantUserActor {
	readonly kind: "user";
	readonly userId: string;
	readonly organizationId: string;
	/** The route key (slug or id) the member's membership was resolved through. */
	readonly orgSlug: string;
}

/** A merchant API key calling an organization route machine-to-machine. */
export interface MerchantApiKeyActor {
	readonly kind: "api_key";
	readonly organizationId: string;
	readonly apiKeyId: string;
	readonly keyScope: OrganizationApiKeyScope;
	/** The store the key is limited to; `null` for an organization-wide key. */
	readonly keyLocationId: string | null;
}

/** Resolved organization actor for RewardHub dashboard and machine-to-machine routes. */
export type MerchantActor = MerchantUserActor | MerchantApiKeyActor;

export const MERCHANT_ACTOR_KEY = "merchantActor";
