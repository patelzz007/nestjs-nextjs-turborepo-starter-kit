/** Resolved merchant actor for dashboard and machine-to-machine routes. */
export interface MerchantActor {
	readonly kind: "user" | "api_key";
	readonly userId: string | null;
	readonly merchantOrgId: string;
	readonly apiKeyId: string | null;
}

export const MERCHANT_ACTOR_KEY = "merchantActor";
