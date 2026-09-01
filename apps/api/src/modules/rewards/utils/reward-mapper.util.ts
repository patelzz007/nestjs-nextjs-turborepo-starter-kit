import type { MerchantOrg, Prisma, Reward } from "@prisma/client";

import { EpochMsSchema, RewardRulesSchema, type EpochMs, type MerchantOrgResponse, type RewardClaimResponse, type RewardResponse, type RewardRules } from "@workspace/shared";

function epochFromDb(value: bigint | number | null | undefined): EpochMs | null {
	if (value === null || value === undefined) {
		return null;
	}
	return EpochMsSchema.parse(Number(value));
}

function epochRequired(value: bigint | number): EpochMs {
	return EpochMsSchema.parse(Number(value));
}

function parseRewardRulesFromDb(value: Prisma.JsonValue | null): RewardRules | null {
	if (value === null) {
		return null;
	}
	const parsed = RewardRulesSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function mapMerchantOrgToResponse(org: MerchantOrg): MerchantOrgResponse {
	return {
		id: org.id,
		businessName: org.businessName,
		legalName: org.legalName,
		category: org.category,
		addressText: org.addressText,
		city: org.city,
		kybStatus: org.kybStatus,
		status: org.status,
		contactEmail: org.contactEmail,
		contactPhone: org.contactPhone,
		createdAt: epochRequired(org.createdAt),
		updatedAt: epochRequired(org.updatedAt),
		isDeleted: org.isDeleted,
		deletedAt: epochFromDb(org.deletedAt),
	};
}

export function mapRewardToResponse(reward: Reward, merchant?: Pick<MerchantOrg, "businessName">): RewardResponse {
	return {
		id: reward.id,
		merchantOrgId: reward.merchantOrgId,
		merchantName: merchant?.businessName,
		title: reward.title,
		description: reward.description,
		rewardType: reward.rewardType,
		rewardValue: reward.rewardValue,
		termsConditions: reward.termsConditions,
		rewardKind: reward.rewardKind,
		category: reward.category,
		placeholderImageKey: reward.placeholderImageKey,
		quantityTotal: reward.quantityTotal,
		quantityRemaining: reward.quantityRemaining,
		quantityReserved: reward.quantityReserved,
		startDate: epochFromDb(reward.startDate),
		expiryDate: epochRequired(reward.expiryDate),
		status: reward.status,
		claimCount: reward.claimCount,
		redemptionCount: reward.redemptionCount,
		referralsEnabled: reward.referralsEnabled,
		referralPoolTotal: reward.referralPoolTotal,
		referralPoolRemaining: reward.referralPoolRemaining,
		referrerRewardId: reward.referrerRewardId,
		rules: parseRewardRulesFromDb(reward.rules),
		createdAt: epochRequired(reward.createdAt),
		updatedAt: epochRequired(reward.updatedAt),
		isDeleted: reward.isDeleted,
		deletedAt: epochFromDb(reward.deletedAt),
	};
}

export function mapClaimToResponse(
	claim: {
		id: string;
		rewardId: string;
		status: RewardClaimResponse["status"];
		claimedAt: bigint | number;
		claimExpiresAt: bigint | number;
		redeemedAt: bigint | number | null;
		isReferrerCredit: boolean;
		createdAt: bigint | number;
		updatedAt: bigint | number;
		isDeleted: boolean;
		deletedAt: bigint | number | null;
	},
	rewardTitle: string,
): RewardClaimResponse {
	return {
		id: claim.id,
		rewardId: claim.rewardId,
		rewardTitle,
		status: claim.status,
		claimedAt: epochRequired(claim.claimedAt),
		claimExpiresAt: epochRequired(claim.claimExpiresAt),
		redeemedAt: epochFromDb(claim.redeemedAt),
		isReferrerCredit: claim.isReferrerCredit,
		createdAt: epochRequired(claim.createdAt),
		updatedAt: epochRequired(claim.updatedAt),
		isDeleted: claim.isDeleted,
		deletedAt: epochFromDb(claim.deletedAt),
	};
}
