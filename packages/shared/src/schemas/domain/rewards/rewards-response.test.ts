import { describe, expect, it } from "vitest";

import { epochMs } from "../../api/common";

import { MerchantKybProfileResponseSchema, type MerchantKybProfileResponse } from "./rewards-kyb";
import { MerchantCreateRewardSchema, RewardResponseSchema, type RewardResponse } from "./rewards-entities";
import { RewardRulesResponseSchema, RewardRulesSchema, type RewardRules } from "./rewards-enums";

// Response schemas are OPEN (ADR 022): the API strips unknown keys and clients
// tolerate additive fields. Request schemas sharing the same fields stay CLOSED.

const CREATED_AT_MS = 1_786_300_000_000;
const EXPIRY_MS = 1_786_400_000_000;
const MIN_SPEND_MYR = 20;
const MAX_USE_PER_USER = 2;
const REWARD_VALUE = 10;
const QUANTITY_TOTAL = 100;
const DOCUMENT_SIZE_BYTES = 2048;

const REWARD_ID = "7f1c1b9e-8a43-4c2e-9d1a-3b7e6f2a9c01";
const ORGANIZATION_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const DOCUMENT_ID = "a3e9d2c1-6b5f-4a7e-8d9c-1f2e3d4c5b6a";

const rules: RewardRules = { minSpendMyr: MIN_SPEND_MYR, maxUsePerUser: MAX_USE_PER_USER };

const reward: RewardResponse = {
	createdAt: epochMs(CREATED_AT_MS),
	updatedAt: epochMs(CREATED_AT_MS),
	isDeleted: false,
	deletedAt: null,
	id: REWARD_ID,
	organizationId: ORGANIZATION_ID,
	organizationLogoUrl: null,
	title: "Free coffee",
	description: "One free coffee",
	rewardType: "FREE_ITEM",
	rewardValue: REWARD_VALUE,
	termsConditions: null,
	rewardKind: "CONSUMER",
	category: "food",
	placeholderImageKey: "food",
	quantityTotal: QUANTITY_TOTAL,
	quantityRemaining: QUANTITY_TOTAL,
	quantityReserved: 0,
	startDate: null,
	expiryDate: epochMs(EXPIRY_MS),
	status: "PUBLISHED",
	claimCount: 0,
	redemptionCount: 0,
	referralsEnabled: false,
	referralPoolTotal: null,
	referralPoolRemaining: null,
	referrerRewardId: null,
	rules,
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

const kybProfile: MerchantKybProfileResponse = {
	organizationId: ORGANIZATION_ID,
	businessName: "Kopi Co",
	legalName: null,
	addressText: null,
	contactPhone: null,
	contactEmail: "owner@example.com",
	city: "KUALA_LUMPUR",
	kybStatus: "PENDING",
	kybFields: null,
	documents: [
		{
			id: DOCUMENT_ID,
			fileName: "ssm.pdf",
			mimeType: "application/pdf",
			sizeBytes: DOCUMENT_SIZE_BYTES,
			scanStatus: "CLEAN",
			uploadedAt: epochMs(CREATED_AT_MS),
		},
	],
	status: "ACTIVE",
};

describe("reward rules", () => {
	it("rejects unknown keys on the request side", () => {
		expect(RewardRulesSchema.safeParse({ ...rules, internalFlag: true }).success).toBe(false);
	});

	it("strips unknown keys on the response side", () => {
		expect(RewardRulesResponseSchema.parse({ ...rules, internalFlag: true })).toEqual(rules);
	});

	it("keeps the merchant create-reward request closed, including nested rules", () => {
		const request = {
			title: "Free coffee",
			description: "One free coffee",
			rewardType: "FREE_ITEM",
			rewardValue: REWARD_VALUE,
			category: "food",
			quantityTotal: QUANTITY_TOTAL,
			expiryDate: EXPIRY_MS,
		};
		expect(MerchantCreateRewardSchema.safeParse(request).success).toBe(true);
		expect(MerchantCreateRewardSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
		expect(MerchantCreateRewardSchema.safeParse({ ...request, rules: { ...rules, internalFlag: true } }).success).toBe(false);
	});
});

describe("RewardResponseSchema", () => {
	it("round-trips a reward intact", () => {
		expect(RewardResponseSchema.parse(reward)).toEqual(reward);
	});

	it("strips internal keys at every level instead of rejecting the payload", () => {
		const leaky = { ...reward, internalCost: 1, rules: { ...rules, internalFlag: true } };
		expect(RewardResponseSchema.parse(leaky)).toEqual(reward);
	});

	it("accepts an http(s) merchant logo URL", () => {
		expect(RewardResponseSchema.safeParse({ ...reward, organizationLogoUrl: "https://cdn.example.com/logos/kopi-co.png" }).success).toBe(true);
		expect(RewardResponseSchema.safeParse({ ...reward, organizationLogoUrl: "http://localhost:3001/api/v1/files/local-download?path=logo.png" }).success).toBe(true);
	});

	it("requires the logo key — null means no logo, absence is a contract break", () => {
		const { organizationLogoUrl, ...withoutLogo } = reward;
		expect(RewardResponseSchema.safeParse(withoutLogo).success).toBe(false);
	});

	it("rejects a non-http(s) or relative logo URL", () => {
		expect(RewardResponseSchema.safeParse({ ...reward, organizationLogoUrl: "javascript:alert(1)" }).success).toBe(false);
		expect(RewardResponseSchema.safeParse({ ...reward, organizationLogoUrl: "data:image/png;base64,AAAA" }).success).toBe(false);
		expect(RewardResponseSchema.safeParse({ ...reward, organizationLogoUrl: "/logos/kopi-co.png" }).success).toBe(false);
	});
});

describe("MerchantKybProfileResponseSchema", () => {
	it("strips unknown keys on the profile and on nested documents", () => {
		const leaky = {
			...kybProfile,
			storageBucket: "private",
			documents: kybProfile.documents.map((document) => ({ ...document, storagePath: "kyb/raw/ssm.pdf" })),
		};
		expect(MerchantKybProfileResponseSchema.parse(leaky)).toEqual(kybProfile);
	});
});
