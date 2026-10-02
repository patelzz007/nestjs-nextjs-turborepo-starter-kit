import type { MerchantApiKeySummary } from "@workspace/shared";

/** Which keys the list shows. */
export type ApiKeyFilter = "active" | "revoked" | "all";

export const API_KEY_FILTERS: readonly ApiKeyFilter[] = ["active", "revoked", "all"];

/** Headline numbers for the API-keys page — computed from the keys the page loaded. */
export interface ApiKeyStats {
	readonly active: number;
	readonly revoked: number;
	/** Distinct stores with at least one active key. */
	readonly storesCovered: number;
	/** An active organization-wide key works at every store. */
	readonly hasOrganizationWideKey: boolean;
}

export function isActiveApiKey(key: MerchantApiKeySummary): boolean {
	return key.revokedAt === null;
}

export function summarizeApiKeys(keys: readonly MerchantApiKeySummary[]): ApiKeyStats {
	const active = keys.filter(isActiveApiKey);
	const stores = new Set(active.flatMap((key): string[] => (key.locationId === null ? [] : [key.locationId])));
	return {
		active: active.length,
		revoked: keys.length - active.length,
		storesCovered: stores.size,
		hasOrganizationWideKey: active.some((key) => key.locationId === null),
	};
}

/** The keys a filter shows: active first by recency, revoked last. */
export function filterApiKeys(keys: readonly MerchantApiKeySummary[], filter: ApiKeyFilter): readonly MerchantApiKeySummary[] {
	if (filter === "active") {
		return keys.filter(isActiveApiKey);
	}
	if (filter === "revoked") {
		return keys.filter((key) => !isActiveApiKey(key));
	}
	return [...keys.filter(isActiveApiKey), ...keys.filter((key) => !isActiveApiKey(key))];
}
