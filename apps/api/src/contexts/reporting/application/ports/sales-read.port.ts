import type { MerchantBusinessCategory } from "@workspace/shared";

/** An inclusive epoch-ms range (`gte` ≤ t ≤ `lte`), as the weekly analytics periods are defined. */
export interface InclusiveRange {
	readonly gte: number;
	readonly lte: number;
}

/** Narrows sales to one organization (and optionally some of its stores) and/or one customer; empty = platform-wide. */
export interface SalesScope {
	readonly organizationId?: string | undefined;
	/** The stores to include (`undefined` = every store; an empty list matches nothing). */
	readonly locationIds?: readonly string[] | undefined;
	readonly userId?: string | undefined;
}

/** Paid-bill totals over a time range. */
export interface SalesAggregate {
	readonly totalMinor: number;
	readonly bills: number;
}

/** Paid-bill totals of one week (Monday 00:00 start in the requested zone). */
export interface SalesWeek {
	readonly weekStartMs: number;
	readonly totalMinor: number;
	readonly bills: number;
}

/** Sales grouped by organization, highest total first. */
export interface SalesGroup {
	readonly organizationId: string;
	readonly totalMinor: number;
	readonly bills: number;
}

/** The display fields a sales breakdown shows per merchant. */
export interface SalesMerchantSummary {
	readonly name: string;
	readonly category: MerchantBusinessCategory | null;
}

/** Paid-bill facts (`RewardSale`) for the weekly sales analytics. */
export interface SalesReadPort {
	/** When the first live bill in `scope` was paid (all time), or `null` before any. */
	firstPaidAt(scope: SalesScope): Promise<number | null>;
	aggregate(scope: SalesScope, range: InclusiveRange): Promise<SalesAggregate>;
	/** Totals per week, grouped in the database (one row per week that has bills). */
	listWeeklyTotals(scope: SalesScope, range: InclusiveRange, timeZone: string): Promise<SalesWeek[]>;
	/** Sales per organization, highest total first; `take` bounds the result (omit for every organization). */
	groupByOrganization(scope: SalesScope, range: InclusiveRange, take?: number): Promise<SalesGroup[]>;
	/** Distinct organizations with at least one bill in the range. */
	countOrganizations(range: InclusiveRange): Promise<number>;
	/** Name + category of merchants whose ids come from sales the caller may already see; `actorUserId` is recorded on the system read. */
	listMerchantSummaries(organizationIds: readonly string[], actorUserId: string | null): Promise<Map<string, SalesMerchantSummary>>;
}
