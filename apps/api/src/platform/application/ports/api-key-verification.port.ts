import type { CapabilitySlug, TenantApiKeyScope } from "@workspace/shared";

/** Supported API key providers — extend when adding user/platform keys. */
export type ApiKeyProvider = "merchant";

/** A terminal a key is bound to (pairing issues exactly one key per terminal). */
export interface PairedTerminal {
	readonly id: string;
	readonly terminalId: string;
	readonly locationId: string;
}

/** A verified merchant API key, attached to the request after authentication. */
export interface MerchantApiKeyAuthContext {
	readonly provider: "merchant";
	readonly apiKeyId: string;
	readonly tenantId: string;
	/** The store the key is limited to; `null` for a tenant-wide key. */
	readonly locationId: string | null;
	/** The terminal this key was issued to by pairing; `null` for a manually created key. */
	readonly terminal: PairedTerminal | null;
	/** The tenant's "only allow registered terminals" policy (applies to manually created keys). */
	readonly requireRegisteredTerminals: boolean;
	/** What the key may call: `POS` keys only the POS redemption routes, `INTEGRATION` keys also the tenant API. */
	readonly scope: TenantApiKeyScope;
	/** Tenant capabilities of {@link scope}. */
	readonly capabilities: readonly CapabilitySlug[];
}

/** Discriminated union of verified API key contexts. */
export type ApiKeyAuthContext = MerchantApiKeyAuthContext;

/**
 * Verifies a presented merchant API key (owned by pos, used by the security kit's guards). `null` for
 * an unknown, revoked or orphaned key; a live key of a merchant that is not operating throws 403
 * `TENANT_NOT_ACTIVE`. A successful verification records the key's last use.
 */
export interface ApiKeyVerificationPort {
	verify(plaintext: string): Promise<MerchantApiKeyAuthContext | null>;
}

export const API_KEY_VERIFICATION = Symbol("API_KEY_VERIFICATION");
