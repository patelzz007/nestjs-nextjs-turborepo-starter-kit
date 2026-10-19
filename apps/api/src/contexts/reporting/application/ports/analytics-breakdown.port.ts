import type { MerchantBusinessCategory, PilotCity, RewardRedemptionMethod } from "@workspace/shared";

import type { AnalyticsScope, AnalyticsTimeRange, AnalyticsWindow, OrganizationAnalyticsScope } from "../../domain/value-objects/analytics-scope.value-object";

export interface StoreBreakdownRow {
	readonly locationId: string | null;
	readonly name: string | null;
	readonly city: PilotCity | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
	readonly redemptions: number;
}

export interface RewardBreakdownRow {
	readonly rewardId: string;
	readonly title: string;
	readonly claims: number;
	readonly redemptions: number;
}

export interface RedemptionMethodRow {
	readonly method: RewardRedemptionMethod;
	readonly redemptions: number;
}

export interface MerchantSalesRow {
	readonly organizationId: string;
	readonly name: string;
	readonly category: MerchantBusinessCategory | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly averageBillMinor: number;
}

export interface CategorySalesRow {
	readonly category: MerchantBusinessCategory | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly merchants: number;
}

export interface CitySalesRow {
	readonly city: PilotCity | null;
	readonly salesMinor: number;
	readonly bills: number;
	readonly merchants: number;
}

/** One merchant's paid bills in one bucket (only buckets with bills). */
export interface MerchantBucketSalesRow {
	readonly organizationId: string;
	readonly startMs: number;
	readonly salesMinor: number;
	readonly bills: number;
}

/** Breakdowns of a range by one dimension, grouped in the database. Every query is bounded by the scope or an explicit `limit`. */
export interface AnalyticsBreakdownReadPort {
	byStore(scope: OrganizationAnalyticsScope, range: AnalyticsTimeRange): Promise<StoreBreakdownRow[]>;
	byReward(scope: OrganizationAnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<RewardBreakdownRow[]>;
	byRedemptionMethod(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<RedemptionMethodRow[]>;
	byMerchant(scope: AnalyticsScope, range: AnalyticsTimeRange, limit: number): Promise<MerchantSalesRow[]>;
	byCategory(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CategorySalesRow[]>;
	byCity(scope: AnalyticsScope, range: AnalyticsTimeRange): Promise<CitySalesRow[]>;
	merchantBucketSales(scope: AnalyticsScope, window: AnalyticsWindow): Promise<MerchantBucketSalesRow[]>;
}
