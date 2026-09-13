/** Resolved organization actor for RewardHub dashboard and machine-to-machine routes. */
export interface MerchantActor {
	readonly kind: "user" | "api_key";
	readonly userId: string | null;
	readonly organizationId: string;
	readonly orgSlug: string | null;
	readonly apiKeyId: string | null;
}

export const MERCHANT_ACTOR_KEY = "merchantActor";
