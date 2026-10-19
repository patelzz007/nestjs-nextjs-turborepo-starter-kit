import type { MerchantApiKeyAuthContext } from "./api-key-verification.port";

/** The till a POS request redeems from: its organization, store (when known), terminal and key. */
export interface TillPoint {
	readonly organizationId: string;
	/** `null` when the store is unknown (an organization-wide key on an unregistered terminal). */
	readonly locationId: string | null;
	readonly terminalId: string;
	readonly apiKeyId: string;
}

/** Why a verified key may not redeem from the till it claims to be (each has its own wire code and status). */
export type TillRefusal = "TERMINAL_KEY_MISMATCH" | "TERMINAL_ID_REQUIRED" | "TERMINAL_NOT_REGISTERED" | "TERMINAL_LOCATION_MISMATCH";

export type TillResolution = { readonly kind: "resolved"; readonly point: TillPoint } | { readonly kind: "refused"; readonly refusal: TillRefusal };

/** Resolves the till a verified merchant key redeems from (owned by pos, used by the security kit's POS guard). */
export interface TillResolverPort {
	resolve(key: MerchantApiKeyAuthContext, requestedTerminalId: string | undefined): Promise<TillResolution>;
}

export const TILL_RESOLVER = Symbol("TILL_RESOLVER");
