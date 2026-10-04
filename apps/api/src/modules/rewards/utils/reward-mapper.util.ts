import type { Organization, OrganizationLifecycleState, OrganizationMerchantProfile, Prisma, Reward } from "@prisma/client";

import {
	EpochMsSchema,
	JsonObjectSchema,
	RewardResponseSchema,
	type AdminMerchantDetailResponse,
	type EpochMs,
	type JsonObject,
	type MerchantKybDocumentRecord,
	type MerchantOrgResponse,
	type RewardClaimResponse,
	type RewardResponse,
} from "@workspace/shared";
import type { OrganizationAdminDetailRow } from "../../organization/repositories/organization.repository";
import { rewardRulesFromStorage } from "./reward-rules.util";

function epochFromDb(value: bigint | number | null | undefined): EpochMs | null {
	if (value === null || value === undefined) {
		return null;
	}
	return EpochMsSchema.parse(Number(value));
}

function epochRequired(value: bigint | number): EpochMs {
	return EpochMsSchema.parse(Number(value));
}

export function mapLifecycleToMerchantStatus(lifecycleState: OrganizationLifecycleState): "ONBOARDING" | "ACTIVE" | "SUSPENDED" {
	if (lifecycleState === "ACTIVE") {
		return "ACTIVE";
	}
	if (lifecycleState === "SUSPENDED") {
		return "SUSPENDED";
	}
	return "ONBOARDING";
}

function parseKybFieldsFromDb(value: Prisma.JsonValue | null): JsonObject | null {
	if (value === null) {
		return null;
	}
	const parsed = JsonObjectSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function mapOrganizationToAdminResponse(org: Organization & { merchantProfile: OrganizationMerchantProfile | null }): MerchantOrgResponse {
	const profile = org.merchantProfile;
	return {
		id: org.id,
		businessName: org.displayName,
		legalName: profile?.legalName ?? null,
		category: profile?.category ?? "",
		addressText: profile?.addressText ?? null,
		city: profile?.city ?? "KUALA_LUMPUR",
		kybStatus: profile?.kybStatus ?? "PENDING",
		status: mapLifecycleToMerchantStatus(org.lifecycleState),
		contactEmail: profile?.contactEmail ?? "",
		contactPhone: profile?.contactPhone ?? null,
		createdAt: epochRequired(org.createdAt),
		updatedAt: epochRequired(org.updatedAt),
		isDeleted: org.isDeleted,
		deletedAt: epochFromDb(org.deletedAt),
	};
}

export function mapOrganizationToAdminDetailResponse(
	org: OrganizationAdminDetailRow,
	documents: readonly MerchantKybDocumentRecord[],
	locations: AdminMerchantDetailResponse["locations"],
): AdminMerchantDetailResponse {
	const ownerMember = org.memberships.find((member) => member.role === "OWNER");
	const base = mapOrganizationToAdminResponse({ ...org, merchantProfile: org.merchantProfile });

	return {
		...base,
		kybFields: parseKybFieldsFromDb(org.merchantProfile?.kybFields ?? null),
		documents: [...documents],
		locations: [...locations],
		ownerUserId: ownerMember?.userId ?? null,
		ownerEmail: ownerMember?.user.email ?? null,
		ownerFullName: ownerMember?.user.fullName ?? null,
		memberCount: org._count.memberships,
	};
}

interface RewardLocationScopeRow {
	readonly locationId: string;
	readonly location: { readonly name: string } | null;
}

type RewardWithLocationScopes = Reward & {
	readonly locationScopes?: readonly RewardLocationScopeRow[];
};

/** The organization fields a reward response carries — the shape the reward repository's include selects. */
export interface RewardOrganizationSummary {
	readonly displayName: string;
	/** Live, READY `LOGO` assets with a public URL (0 or 1 — `(organizationId, assetType)` is unique). */
	readonly assets: readonly { readonly file: { readonly publicPath: string | null } }[];
}

/** The response contract's own rule for a logo URL — the stored value is re-checked against it. */
const OrganizationLogoUrlSchema = RewardResponseSchema.shape.organizationLogoUrl;

/**
 * The merchant logo URL for a reward response, or `null` (clients render a
 * name monogram). A stored value that does not satisfy the contract (not an
 * absolute http(s) URL) also degrades to `null`, deliberately: a bad logo
 * must cost the merchant their logo, not fail the whole reward list.
 */
export function resolveOrganizationLogoUrl(organization: RewardOrganizationSummary | undefined): string | null {
	const publicPath = organization?.assets.at(0)?.file.publicPath ?? null;
	if (publicPath === null) {
		return null;
	}
	const parsed = OrganizationLogoUrlSchema.safeParse(publicPath);
	return parsed.success ? parsed.data : null;
}

export function mapRewardToResponse(reward: RewardWithLocationScopes, organization?: RewardOrganizationSummary): RewardResponse {
	const locationScopes = reward.locationScopes ?? [];
	const resolvedScopes = locationScopes.flatMap((scope) => {
		if (scope.location === null) {
			return [];
		}

		return [{ locationId: scope.locationId, name: scope.location.name }];
	});
	const locationIds = resolvedScopes.map((scope) => scope.locationId);
	const locationNames = resolvedScopes.map((scope) => scope.name);

	return {
		id: reward.id,
		organizationId: reward.organizationId,
		organizationName: organization?.displayName,
		organizationLogoUrl: resolveOrganizationLogoUrl(organization),
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
		rules: rewardRulesFromStorage(reward.rules, reward.minSpendMinor),
		locationScopeType: reward.locationScopeType,
		locationIds,
		locationNames: locationNames.length > 0 ? locationNames : undefined,
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
