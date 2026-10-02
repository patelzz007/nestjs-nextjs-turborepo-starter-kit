import type { MerchantApiKeySummary } from "@workspace/shared";
import { z } from "zod";

/** Which keys the list shows — a view filter over the loaded keys, held in the URL (`?status=`, lib/url-state/api-keys). */
export const ApiKeyFilterSchema = z.enum(["active", "revoked", "all"]);
export type ApiKeyFilter = z.output<typeof ApiKeyFilterSchema>;

/** The filter options in display order. */
export const API_KEY_FILTERS: readonly ApiKeyFilter[] = ApiKeyFilterSchema.options;

/** The list opens on the keys that work today. */
export const DEFAULT_API_KEY_FILTER: ApiKeyFilter = "active";

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
