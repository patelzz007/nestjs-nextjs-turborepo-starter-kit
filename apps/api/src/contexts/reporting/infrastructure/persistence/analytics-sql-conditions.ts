import { Prisma } from "@prisma/client";
import { DEFAULT_SALE_CURRENCY } from "@workspace/shared";

import type { AnalyticsScope, AnalyticsTimeRange } from "../../domain/value-objects/analytics-scope.value-object";

/** `<column> = ANY(<ids>)` — an empty id list matches nothing, by construction. */
function inLocations(column: Prisma.Sql, locationIds: readonly string[]): Prisma.Sql {
	return Prisma.sql`${column} = ANY(${[...locationIds]}::text[])`;
}

/**
 * Filters of `"RewardSale" s` for `scope`: live bills in the platform currency
 * (totals only add up within one currency). Bills without a store are
 * organization-wide: only an all-stores caller sees them.
 */
export function salesConditions(scope: AnalyticsScope): Prisma.Sql[] {
	const base: Prisma.Sql[] = [Prisma.sql`s."isDeleted" = false`, Prisma.sql`s.currency = ${DEFAULT_SALE_CURRENCY}`];
	switch (scope.kind) {
		case "platform":
			return base;
		case "customer":
			return [...base, Prisma.sql`s."userId" = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`s."organizationId" = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS" ? [] : [inLocations(Prisma.sql`s."locationId"`, scope.locationScope.locationIds)]),
			];
	}
}

/**
 * Filters of `reward_redemptions rd` (joined to its live claim `c`) for
 * `scope`. A redemption belongs to the store it was redeemed at.
 */
export function redemptionConditions(scope: AnalyticsScope): Prisma.Sql[] {
	const base: Prisma.Sql[] = [Prisma.sql`rd."isDeleted" = false`, Prisma.sql`c."isDeleted" = false`];
	switch (scope.kind) {
		case "platform":
			return base;
		case "customer":
			return [...base, Prisma.sql`rd."userId" = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`rd."organizationId" = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS" ? [] : [inLocations(Prisma.sql`rd."locationId"`, scope.locationScope.locationIds)]),
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
	const base: Prisma.Sql[] = [Prisma.sql`c."isDeleted" = false`];
	switch (scope.kind) {
		case "platform":
			return [...base, Prisma.sql`r."isDeleted" = false`];
		case "customer":
			return [...base, Prisma.sql`c."userId" = ${scope.userId}`];
		case "organization":
			return [
				...base,
				Prisma.sql`r."isDeleted" = false`,
				Prisma.sql`r."organizationId" = ${scope.organizationId}`,
				...(scope.locationScope.kind === "ALL_LOCATIONS"
					? []
					: [
							Prisma.sql`(r."locationScopeType" = 'ALL_LOCATIONS' OR EXISTS (
								SELECT 1 FROM "RewardLocationScope" rls WHERE rls."rewardId" = r.id AND ${inLocations(Prisma.sql`rls."locationId"`, scope.locationScope.locationIds)}
							))`,
						]),
			];
	}
}

/** `FROM "RewardClaim" c …` for `scope` — joined to the reward unless the scope is one customer. */
export function claimSource(scope: AnalyticsScope): Prisma.Sql {
	return scope.kind === "customer" ? Prisma.sql`"RewardClaim" c` : Prisma.sql`"RewardClaim" c JOIN "Reward" r ON r.id = c."rewardId"`;
}

/** `<column> >= from AND <column> < to` — every range is half-open. */
export function withinRange(column: Prisma.Sql, range: AnalyticsTimeRange): Prisma.Sql {
	return Prisma.sql`${column} >= ${range.fromMs}::bigint AND ${column} < ${range.toMs}::bigint`;
}

/** `a AND b AND …` of a non-empty condition list. */
export function allOf(conditions: readonly Prisma.Sql[]): Prisma.Sql {
	return Prisma.join([...conditions], " AND ");
}

/** `<column> >= gte AND <column> <= lte`: the inclusive range the weekly analytics compare. */
export function withinInclusive(column: Prisma.Sql, range: { readonly gte: number; readonly lte: number }): Prisma.Sql {
	return Prisma.sql`${column} >= ${range.gte}::bigint AND ${column} <= ${range.lte}::bigint`;
}

/**
 * The epoch-ms start of the week (Monday 00:00 in `timeZone`, an IANA name validated upstream and
 * passed as a bind parameter) holding the epoch-ms `column`. The one definition of a week every grouped
 * analytics read uses, matching `startOfWeekInTimeZone` in `@workspace/shared`.
 */
export function weekStartMsSql(column: Prisma.Sql, timeZone: string): Prisma.Sql {
	return Prisma.sql`(EXTRACT(EPOCH FROM (date_trunc('week', to_timestamp(${column} / 1000.0) AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})) * 1000)::bigint`;
}
