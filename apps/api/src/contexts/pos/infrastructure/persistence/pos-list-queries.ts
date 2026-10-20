import type { Prisma } from "@prisma/client";
import {
	merchantApiKeyListQuery,
	merchantRedemptionListQuery,
	merchantTerminalListQuery,
	type MerchantApiKeyListQuery,
	type MerchantApiKeyListSortField,
	type MerchantRedemptionListQuery,
	type MerchantRedemptionListSortField,
	type MerchantTerminalListQuery,
	type MerchantTerminalListSortField,
} from "@workspace/shared";

import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaNullableComparableFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";

// List query → Prisma: explicit field → column mappings (see docs/technical/api/list-queries.md). The
// tenant and the store grant are authorization scopes resolved by the handler, never raw input.

/** Prisma `in` filter on a `locationId` column for the grant; `undefined` = every store. */
export function locationIdInFilter(grant: MerchantAccessGrant): { in: string[] } | undefined {
	return grant.locationScope === "ALL_LOCATIONS" ? undefined : { in: [...grant.locationIds] };
}

// ── Terminals ────────────────────────────────────────────────────────────

const TERMINAL_SORT_COLUMNS: SortColumns<MerchantTerminalListSortField, Prisma.TenantTerminalOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ label: direction }),
};

/** The tenant's live terminals within the granted stores. */
export function buildTerminalListWhere(grant: MerchantAccessGrant): Prisma.TenantTerminalWhereInput {
	const locationFilter = locationIdInFilter(grant);
	return { AND: [{ tenantId: grant.tenantId, isDeleted: false }, ...(locationFilter !== undefined ? [{ locationId: locationFilter }] : [])] };
}

export function buildTerminalListOrder(query: MerchantTerminalListQuery): ListOrder<Prisma.TenantTerminalOrderByWithRelationInput> {
	return buildListOrder(merchantTerminalListQuery.resolveSort(query.sort), { columns: TERMINAL_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

// ── API keys ─────────────────────────────────────────────────────────────

const API_KEY_SORT_COLUMNS: SortColumns<MerchantApiKeyListSortField, Prisma.TenantApiKeyOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** The tenant's live keys within the granted stores; a store-limited grant excludes tenant-wide keys (`location_id IS NULL`). */
export function buildApiKeyListWhere(grant: MerchantAccessGrant, query: MerchantApiKeyListQuery): Prisma.TenantApiKeyWhereInput {
	const locationFilter = locationIdInFilter(grant);
	return {
		AND: [
			{ tenantId: grant.tenantId, isDeleted: false },
			...(locationFilter !== undefined ? [{ locationId: locationFilter }] : []),
			...fieldWhere(toPrismaNullableComparableFilter<number>(query.filter?.revokedAt), (revokedAt) => ({ revokedAt })),
		],
	};
}

export function buildApiKeyListOrder(query: MerchantApiKeyListQuery): ListOrder<Prisma.TenantApiKeyOrderByWithRelationInput> {
	return buildListOrder(merchantApiKeyListQuery.resolveSort(query.sort), { columns: API_KEY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

// ── Redemptions ──────────────────────────────────────────────────────────

const REDEMPTION_SORT_COLUMNS: SortColumns<MerchantRedemptionListSortField, Prisma.RewardRedemptionOrderByWithRelationInput> = {
	redeemedAt: (direction) => ({ redeemedAt: direction }),
};

/**
 * The tenant's live redemptions within the granted stores, plus the `redeemedAt` window filter.
 * A store-limited grant excludes redemptions with no recorded store.
 */
export function buildRedemptionListWhere(grant: MerchantAccessGrant, query: MerchantRedemptionListQuery): Prisma.RewardRedemptionWhereInput {
	const locationFilter = locationIdInFilter(grant);
	return {
		AND: [
			{ tenantId: grant.tenantId, isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } },
			...(locationFilter !== undefined ? [{ locationId: locationFilter }] : []),
			...fieldWhere(toPrismaComparableFilter(query.filter?.redeemedAt), (redeemedAt) => ({ redeemedAt })),
		],
	};
}

export function buildRedemptionListOrder(query: MerchantRedemptionListQuery): ListOrder<Prisma.RewardRedemptionOrderByWithRelationInput> {
	return buildListOrder(merchantRedemptionListQuery.resolveSort(query.sort), { columns: REDEMPTION_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}
