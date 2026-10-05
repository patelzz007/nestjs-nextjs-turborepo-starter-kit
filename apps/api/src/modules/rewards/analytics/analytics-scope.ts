import { Prisma } from "@prisma/client";
import { DEFAULT_SALE_CURRENCY, type AnalyticsInterval } from "@workspace/shared";

import type { MerchantLocationScope } from "../types/merchant-location-scope";

/** A half-open time range `[fromMs, toMs)` in epoch ms. */
export interface AnalyticsTimeRange {
	readonly fromMs: number;
	readonly toMs: number;
}

/** A range cut into buckets: `interval`-wide, at local midnight / Monday / the 1st in `timeZone`. */
export interface AnalyticsWindow extends AnalyticsTimeRange {
	/** IANA zone, validated by `IanaTimeZoneSchema` upstream; always a bind parameter. */
	readonly timeZone: string;
	readonly interval: AnalyticsInterval;
}

/**
 * WHOSE activity an analytics query covers — resolved server-side from the
 * caller (never from raw client input):
 *
 * - `platform`: every merchant (the admin view).
 * - `organization`: one merchant, limited to `locationScope` (a store-limited
 *   member or store-scoped API key never sees another store's bills,
 *   redemptions, or claims of rewards not offered at its stores).
 * - `customer`: one customer's own activity.
 */
export type AnalyticsScope =
	| { readonly kind: "platform" }
	| { readonly kind: "organization"; readonly organizationId: string; readonly locationScope: MerchantLocationScope }
	| { readonly kind: "customer"; readonly userId: string };

/** `<column> = ANY(<ids>)` — an empty id list matches nothing, by construction. */
function inLocations(column: Prisma.Sql, locationIds: readonly string[]): Prisma.Sql {
	return Prisma.sql`${column} = ANY(${[...locationIds]}::text[])`;
}

/**
 * Filters of `reward_sales s` for `scope`: live bills in the platform currency
 * (totals only add up within one currency). Bills without a store are
 * organization-wide: only an all-stores caller sees them.
 */
export function salesConditions(scope: AnalyticsScope): Prisma.Sql[] {
	const base: Prisma.Sql[] = [Prisma.sql`s.is_deleted = false`, Prisma.sql`s.currency = ${DEFAULT_SALE_CURRENCY}`];
	switch (scope.kind) {
		case "platform":
			return base;
		case "customer":
			return [...base, Prisma.sql`s.user_id = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`s.organization_id = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS" ? [] : [inLocations(Prisma.sql`s.location_id`, scope.locationScope.locationIds)]),
			];
	}
}

/**
 * Filters of `reward_redemptions rd` (joined to its live claim `c`) for
 * `scope`. A redemption belongs to the store it was redeemed at.
 */
export function redemptionConditions(scope: AnalyticsScope): Prisma.Sql[] {
	const base: Prisma.Sql[] = [Prisma.sql`rd.is_deleted = false`, Prisma.sql`c.is_deleted = false`];
	switch (scope.kind) {
		case "platform":
			return base;
		case "customer":
			return [...base, Prisma.sql`rd.user_id = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`rd.organization_id = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS" ? [] : [inLocations(Prisma.sql`rd.location_id`, scope.locationScope.locationIds)]),
			];
	}
}

/**
 * Filters of `reward_claims c` (joined to its reward `r`) for `scope`. Live
 * claims of live rewards; a merchant counts the claims of its rewards that are
 * offered at one of the caller's stores (organization-wide rewards count for
 * every store). A customer's own claims are counted without reading the
 * reward, so a reward the customer can no longer see still counts.
 */
export function claimConditions(scope: AnalyticsScope): Prisma.Sql[] {
	const base: Prisma.Sql[] = [Prisma.sql`c.is_deleted = false`];
	switch (scope.kind) {
		case "platform":
			return [...base, Prisma.sql`r.is_deleted = false`];
		case "customer":
			return [...base, Prisma.sql`c.user_id = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`r.is_deleted = false`,
				Prisma.sql`r.organization_id = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS"
					? []
					: [
							Prisma.sql`(r.location_scope_type = 'ALL_LOCATIONS' OR EXISTS (
								SELECT 1 FROM reward_location_scopes rls WHERE rls.reward_id = r.id AND ${inLocations(Prisma.sql`rls.location_id`, scope.locationScope.locationIds)}
							))`,
						]),
			];
	}
}

/** `FROM reward_claims c …` for `scope` — joined to the reward unless the scope is one customer. */
export function claimSource(scope: AnalyticsScope): Prisma.Sql {
	return scope.kind === "customer" ? Prisma.sql`reward_claims c` : Prisma.sql`reward_claims c JOIN rewards r ON r.id = c.reward_id`;
}

/** `<column> >= from AND <column> < to` — every range is half-open. */
export function withinRange(column: Prisma.Sql, range: AnalyticsTimeRange): Prisma.Sql {
	return Prisma.sql`${column} >= ${range.fromMs}::bigint AND ${column} < ${range.toMs}::bigint`;
}

/** `a AND b AND …` of a non-empty condition list. */
export function allOf(conditions: readonly Prisma.Sql[]): Prisma.Sql {
	return Prisma.join([...conditions], " AND ");
}
