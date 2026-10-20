import { MERCHANT_API_KEYS_PAGE_SIZE, type MerchantApiKeySummary } from "@workspace/shared";
import { z } from "zod";

/** Which keys the list shows — sent to the API as a filter, held in the URL (`?status=`, lib/url-state/api-keys). */
export const ApiKeyFilterSchema = z.enum(["active", "revoked", "all"]);
export type ApiKeyFilter = z.output<typeof ApiKeyFilterSchema>;

/** The filter options in display order. */
export const API_KEY_FILTERS: readonly ApiKeyFilter[] = ApiKeyFilterSchema.options;

/** The list opens on the keys that work today. */
export const DEFAULT_API_KEY_FILTER: ApiKeyFilter = "active";

/**
 * A count request needs only `meta.total`; one row is the smallest page the
 * list grammar accepts.
 */
export const API_KEY_COUNT_PAGE_SIZE = 1;

/** `filter[revokedAt][isNull]` — `true` = active keys, `false` = revoked keys. */
interface ApiKeyRevokedAtFilter {
	readonly revokedAt: { readonly isNull: boolean };
}

/** `GET /orgs/:orgSlug/api-keys` input for one view of the list. */
export interface ApiKeyListQueryInput {
	readonly orgSlug: string;
	readonly page: number;
	readonly limit: number;
	/** The tenant-context store scope (`undefined` = every store the member may see). */
	readonly locationId: string | undefined;
	readonly filter?: ApiKeyRevokedAtFilter;
}

/** The API filter for a status view (`undefined` = every key). */
export function toApiKeyRevokedAtFilter(filter: ApiKeyFilter): ApiKeyRevokedAtFilter | undefined {
	switch (filter) {
		case "active":
			return { revokedAt: { isNull: true } };
		case "revoked":
			return { revokedAt: { isNull: false } };
		case "all":
			return undefined;
	}
}

/**
 * The request for one status view — filtered by the API, so the list and its
 * total cover every key, not just the keys one page happened to hold. Built by
 * the server page (prefetch) and the view (query) from the same inputs, so the
 * prefetched page lands under the client's query key.
 */
export function toApiKeyListQuery(orgSlug: string, locationId: string | undefined, filter: ApiKeyFilter, limit: number = MERCHANT_API_KEYS_PAGE_SIZE): ApiKeyListQueryInput {
	const revokedAtFilter = toApiKeyRevokedAtFilter(filter);
	return { orgSlug, page: 1, limit, locationId, ...(revokedAtFilter === undefined ? {} : { filter: revokedAtFilter }) };
}

/** Stores covered by active keys — exact only when every active key is loaded. */
export type ApiKeyStoreCoverage =
	| { readonly kind: "exact"; readonly stores: number; readonly hasOrganizationWideKey: boolean }
	/** More active keys exist than one page holds: counting the loaded ones would understate it. */
	| { readonly kind: "unavailable" };

/** Headline numbers for the API-keys page — totals from the API, never counts of one page. */
export interface ApiKeyStats {
	readonly active: number;
	readonly revoked: number;
	readonly coverage: ApiKeyStoreCoverage;
}

/** The active keys page as loaded: its rows and the API's total of active keys. */
export interface ActiveApiKeysPage {
	readonly keys: readonly MerchantApiKeySummary[];
	readonly total: number;
}

export function isActiveApiKey(key: MerchantApiKeySummary): boolean {
	return key.revokedAt === null;
}

/** Distinct stores (and whether one key is organization-wide) across a COMPLETE set of active keys. */
function coverageOf(activeKeys: readonly MerchantApiKeySummary[]): ApiKeyStoreCoverage {
	const stores = new Set(activeKeys.flatMap((key): string[] => (key.locationId === null ? [] : [key.locationId])));
	return { kind: "exact", stores: stores.size, hasOrganizationWideKey: activeKeys.some((key) => key.locationId === null) };
}

/**
 * The page's stats: the active and revoked TOTALS come from the API's
 * filtered counts; store coverage is derived from the active keys only when
 * the page holds all of them, and is otherwise reported as unavailable rather
 * than as a page-sized undercount.
 */
export function summarizeApiKeys(activePage: ActiveApiKeysPage, revokedTotal: number): ApiKeyStats {
	const isComplete = activePage.keys.length >= activePage.total;
	return {
		active: activePage.total,
		revoked: revokedTotal,
		coverage: isComplete ? coverageOf(activePage.keys.filter(isActiveApiKey)) : { kind: "unavailable" },
	};
}
