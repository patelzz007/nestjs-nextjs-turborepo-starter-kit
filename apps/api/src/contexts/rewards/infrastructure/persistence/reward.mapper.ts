import { Prisma, type Reward as RewardRow } from "@prisma/client";
import { epochMs, JsonValueSchema, RewardTypeSchema, type EpochMs, type JsonValue } from "@workspace/shared";

import type { RewardInventoryCounts, RewardRowState, RewardState } from "../../domain/aggregates/reward.state";
import { RewardLocationScope } from "../../domain/value-objects/reward-location-scope.value-object";
import { RewardRulesValue } from "../../domain/value-objects/reward-rules.value-object";
import { RewardKindValueSchema } from "../../domain/value-objects/reward-status.value-object";

/**
 * What a command load selects: the reward row, its live images in order, every store it names
 * (with the store's state, for claimability), and its referrer child row.
 */
export const REWARD_AGGREGATE_INCLUDE = {
	images: { where: { isDeleted: false }, orderBy: { position: "asc" }, select: { fileId: true } },
	locationScopes: { select: { locationId: true, location: { select: { isDeleted: true, status: true } } } },
	referrerReward: true,
} satisfies Prisma.RewardInclude;

export type RewardAggregateRow = Prisma.RewardGetPayload<{ include: typeof REWARD_AGGREGATE_INCLUDE }>;

function epoch(value: bigint): EpochMs {
	return epochMs(Number(value));
}

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epoch(value);
}

function inventoryOf(row: RewardRow): RewardInventoryCounts {
	return {
		quantityTotal: row.quantityTotal,
		quantityRemaining: row.quantityRemaining,
		quantityReserved: row.quantityReserved,
		claimCount: row.claimCount,
		redemptionCount: row.redemptionCount,
	};
}

function rowState(row: RewardRow): RewardRowState {
	return {
		id: row.id,
		kind: RewardKindValueSchema.parse(row.rewardKind),
		status: row.status,
		title: row.title,
		description: row.description,
		offer: { rewardType: RewardTypeSchema.parse(row.rewardType), rewardValue: row.rewardValue, termsConditions: row.termsConditions, category: row.category },
		startDate: epochOrNull(row.startDate),
		expiryDate: epoch(row.expiryDate),
		inventory: inventoryOf(row),
		submittedForReviewAt: epochOrNull(row.submittedForReviewAt),
		autoPublishAt: epochOrNull(row.autoPublishAt),
		reviewedAt: epochOrNull(row.reviewedAt),
		reviewedByUserId: row.reviewedByUserId,
		updatedAt: epoch(row.updatedAt),
	};
}

/** The stored `rules` JSON, validated as JSON (the rules schema itself is checked by the value object). */
export function storedRulesJson(value: Prisma.JsonValue | null): JsonValue | null {
	return JsonValueSchema.nullable().parse(value);
}

/** A command load as the aggregate takes it. A soft-deleted referrer child counts as none. */
export function toRewardState(row: RewardAggregateRow): RewardState {
	const child = row.referrerReward;
	return {
		...rowState(row),
		tenantId: row.tenantId,
		rules: RewardRulesValue.fromStorage(storedRulesJson(row.rules), row.minSpendMinor),
		rejectionReason: row.rejectionReason,
		referralsEnabled: row.referralsEnabled,
		referralPoolTotal: row.referralPoolTotal,
		referralPoolRemaining: row.referralPoolRemaining,
		locationScope: RewardLocationScope.fromStorage(
			row.locationScopeType,
			row.locationScopes.map((scope) => scope.locationId),
		),
		imageFileIds: row.images.map((image) => image.fileId),
		availableAtActiveStore: row.locationScopeType === "ALL_LOCATIONS" || row.locationScopes.some((scope) => !scope.location.isDeleted && scope.location.status === "ACTIVE"),
		referrer: child === null || child.isDeleted ? null : rowState(child),
	};
}

/** The `rules` JSON column value for stored rules (`DbNull` when there are none besides the minimum spend). */
export function rulesColumn(rules: RewardRulesValue): Prisma.InputJsonObject | typeof Prisma.DbNull {
	const stored = rules.storedRules();
	return stored === null ? Prisma.DbNull : { ...stored };
}
