import type { CapabilitySlug, OrganizationApiKeyScope } from "@workspace/shared";

/** Supported API key providers — extend when adding user/platform keys. */
export type ApiKeyProvider = "merchant";

/** A terminal a key is bound to (pairing issues exactly one key per terminal). */
export interface PairedTerminal {
	readonly id: string;
	readonly terminalId: string;
	readonly locationId: string;
}

/** Verified merchant API key attached to the request after authentication. */
export interface MerchantApiKeyAuthContext {
	readonly provider: "merchant";
	readonly apiKeyId: string;
	readonly organizationId: string;
	/** The store the key is limited to; `null` for an organization-wide key. */
	readonly locationId: string | null;
	/** The terminal this key was issued to by pairing; `null` for a manually created key. */
	readonly terminal: PairedTerminal | null;
	/** The organization's "only allow registered terminals" policy (applies to manually created keys). */
	readonly requireRegisteredTerminals: boolean;
	/** What the key may call: `POS` keys only the POS redemption routes, `INTEGRATION` keys also the organization API. */
	readonly scope: OrganizationApiKeyScope;
	/** Organization capabilities of {@link scope} (see `MERCHANT_API_KEY_SCOPE_CAPABILITIES`). */
	readonly capabilities: readonly CapabilitySlug[];
}

/** Discriminated union of verified API key contexts. */
export type ApiKeyAuthContext = MerchantApiKeyAuthContext;

export const API_KEY_AUTH_CONTEXT_KEY = "apiKeyAuth";
