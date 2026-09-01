/** POS redemption context attached by `MerchantApiKeyGuard`. */
export interface MerchantPosContext {
	readonly merchantOrgId: string;
	readonly terminalId: string;
	readonly apiKeyId: string;
}

export const MERCHANT_POS_CONTEXT_KEY = "merchantPosContext";
