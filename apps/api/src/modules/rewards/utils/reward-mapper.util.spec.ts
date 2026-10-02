import type { Reward } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { RewardResponseSchema } from "@workspace/shared";

import { mapRewardToResponse, resolveOrganizationLogoUrl, type RewardOrganizationSummary } from "./reward-mapper.util";

const CREATED_AT_MS = 1_786_300_000_000n;
const EXPIRY_MS = 1_786_400_000_000n;
const QUANTITY_TOTAL = 100;
const LOGO_URL = "https://cdn.example.com/organizations/kopi-co/logo.png";

/** A complete reward row; each case overrides only what it is about. */
function buildRewardRow(overrides: Partial<Reward> = {}): Reward {
	return {
		id: "7f1c1b9e-8a43-4c2e-9d1a-3b7e6f2a9c01",
		organizationId: "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10",
		title: "Free coffee",
		description: "One free coffee",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		placeholderImageKey: "cafe",
		rules: null,
		quantityTotal: QUANTITY_TOTAL,
		quantityRemaining: QUANTITY_TOTAL,
		quantityReserved: 0,
		startDate: null,
		expiryDate: EXPIRY_MS,
		status: "PUBLISHED",
		claimCount: 0,
		redemptionCount: 0,
		metadata: null,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		parentConsumerRewardId: null,
		locationScopeType: "ALL_LOCATIONS",
		submittedForReviewAt: null,
		autoPublishAt: null,
		reviewedAt: null,
		reviewedByUserId: null,
		rejectionReason: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: CREATED_AT_MS,
		updatedAt: CREATED_AT_MS,
		...overrides,
	};
}

function organization(publicPaths: readonly (string | null)[]): RewardOrganizationSummary {
	return { displayName: "Kopi Co", assets: publicPaths.map((publicPath) => ({ file: { publicPath } })) };
}

describe("resolveOrganizationLogoUrl", () => {
	it("returns the logo's public URL when the organization has a READY logo", () => {
		expect(resolveOrganizationLogoUrl(organization([LOGO_URL]))).toBe(LOGO_URL);
	});

	it("returns null when the organization has no logo asset", () => {
		expect(resolveOrganizationLogoUrl(organization([]))).toBeNull();
	});

	it("returns null when the logo file has no public URL yet", () => {
		expect(resolveOrganizationLogoUrl(organization([null]))).toBeNull();
	});

	it("returns null when no organization was loaded", () => {
		expect(resolveOrganizationLogoUrl(undefined)).toBeNull();
	});

	it("degrades a stored value that breaks the contract to null instead of failing the response", () => {
		expect(resolveOrganizationLogoUrl(organization(["organizations/kopi-co/logo.png"]))).toBeNull();
		expect(resolveOrganizationLogoUrl(organization(["javascript:alert(1)"]))).toBeNull();
	});
});

describe("mapRewardToResponse merchant identity", () => {
	it("carries the merchant name and logo URL, and satisfies the response contract", () => {
		const response = mapRewardToResponse(buildRewardRow(), organization([LOGO_URL]));

		expect(response.organizationName).toBe("Kopi Co");
		expect(response.organizationLogoUrl).toBe(LOGO_URL);
		expect(RewardResponseSchema.safeParse(response).success).toBe(true);
	});

	it("sends an explicit null logo (monogram fallback) when the merchant has none", () => {
		const response = mapRewardToResponse(buildRewardRow(), organization([]));

		expect(response.organizationLogoUrl).toBeNull();
		expect(RewardResponseSchema.safeParse(response).success).toBe(true);
	});

	it("sends a null logo when the reward is mapped without its organization", () => {
		const response = mapRewardToResponse(buildRewardRow());

		expect(response.organizationName).toBeUndefined();
		expect(response.organizationLogoUrl).toBeNull();
	});
});
