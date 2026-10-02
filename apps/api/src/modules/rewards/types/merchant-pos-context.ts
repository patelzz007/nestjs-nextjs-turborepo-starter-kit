/** POS redemption context attached by `MerchantApiKeyGuard`. */
export interface MerchantPosContext {
	readonly organizationId: string;
	readonly terminalId: string;
	readonly apiKeyId: string;
	/** The store the request comes from (see `MerchantApiKeyGuard`); `null` when unknown. */
	readonly locationId: string | null;
}

export const MERCHANT_POS_CONTEXT_KEY = "merchantPosContext";
