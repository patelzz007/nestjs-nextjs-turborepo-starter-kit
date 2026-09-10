import type { CapabilitySlug } from "@workspace/shared";

/** Supported API key providers — extend when adding user/platform keys. */
export type ApiKeyProvider = "merchant";

/** Verified merchant API key attached to the request after authentication. */
export interface MerchantApiKeyAuthContext {
	readonly provider: "merchant";
	readonly apiKeyId: string;
	readonly merchantOrgId: string;
	readonly capabilities: readonly CapabilitySlug[];
}

/** Discriminated union of verified API key contexts. */
export type ApiKeyAuthContext = MerchantApiKeyAuthContext;

export const API_KEY_AUTH_CONTEXT_KEY = "apiKeyAuth";
