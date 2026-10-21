// Per-resource list translators: the validated list query (sort + filter AST +
// search) → the exact Prisma `where` / `orderBy` each repository sends. Every
// order ends with the unique `id` tie-breaker so offset pages are stable.

import {
	AdminLocationRequestListQuerySchema,
	AdminMerchantListQuerySchema,
	AdminMfaRecoveryListQuerySchema,
	AdminUserListQuerySchema,
	AuditLogQuerySchema,
	EmailLogListQuerySchema,
	ProductListQuerySchema,
	RewardClaimListQuerySchema,
	RewardListQuerySchema,
	RewardNotificationListQuerySchema,
	SampleCategoryListQuerySchema,
	MerchantRedemptionListQuerySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	buildAdminUserListOrder,
	buildAdminUserListWhere,
	buildMfaRecoveryListOrder,
	buildMfaRecoveryListWhere,
} from "../identity/infrastructure/persistence/prisma-identity.read-repository";
import { buildAuditLogListOrder } from "../authorization/infrastructure/persistence/prisma-permission-audit-log.read-repository";
import { buildEmailLogListOrder, buildEmailLogListWhere } from "../notifications/infrastructure/persistence/prisma-email-log.read-repository";
import {
	buildAdminLocationRequestListOrder,
	buildAdminLocationRequestListWhere,
	buildAdminMerchantListOrder,
	buildAdminMerchantListWhere,
} from "../tenancy/infrastructure/persistence/prisma-merchant-admin.read-repository";
import { buildProductListOrder, buildProductListWhere } from "../catalog/infrastructure/persistence/prisma-product.repository";
import { buildRewardClaimListOrder, buildRewardClaimListWhere, buildRewardNotificationListWhere } from "../claims/infrastructure/persistence/claim-list-queries";
import { buildRedemptionListOrder, buildRedemptionListWhere } from "../pos/infrastructure/persistence/pos-list-queries";
import { buildMarketplaceOrder, buildMarketplaceWhere } from "../rewards/public-api";
import { MARKETPLACE_REWARD_SELECT } from "../rewards/infrastructure/persistence/reward-list-queries";
import type { MerchantAccessGrant } from "../../platform/application/ports/authorization.port";
import { buildSampleCategoryListOrder } from "../catalog/infrastructure/persistence/prisma-sample-category.repository";

const NOW = BigInt(1_790_812_800_000);
const USER_ID = "6f1c2a52-9a3e-4d38-9a55-0d1e2f3a4b5c";
const ORG_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";
const CATEGORY_ID = "8b3e4c74-1c50-4f5a-9c77-2f3a4b5c6d7e";

/** A merchant grant over every store of {@link ORG_ID}. */
const ALL_STORES: MerchantAccessGrant = { tenantId: ORG_ID, locationScope: "ALL_LOCATIONS", locationIds: [] };

/** A merchant grant over exactly these stores of {@link ORG_ID}. */
function selectedStores(locationIds: readonly string[]): MerchantAccessGrant {
	return { tenantId: ORG_ID, locationScope: "SELECTED", locationIds };
}

describe("product", () => {
	it("maps every filter onto its own column, adds search, and keeps soft-deleted rows out", () => {
		const query = ProductListQuerySchema.parse({
			search: "shoe",
			filter: { isActive: { eq: "true" }, categoryId: { in: CATEGORY_ID }, brand: { contains: "ac" }, price: { gte: "10", lte: "99" } },
		});
		expect(buildProductListWhere(query)).toEqual({
			AND: [
				{ deletedAt: null },
				{ isActive: { equals: true } },
				{ categoryId: { in: [CATEGORY_ID] } },
				{ brand: { contains: "ac", mode: "insensitive" } },
				{ price: { gte: 10, lte: 99 } },
				{
					OR: [
						{ brand: { contains: "shoe", mode: "insensitive" } },
						{ name: { contains: "shoe", mode: "insensitive" } },
						{ sku: { contains: "shoe", mode: "insensitive" } },
						{ slug: { contains: "shoe", mode: "insensitive" } },
					],
				},
			],
		});
	});

	it("sorts by the whitelisted columns with an id tie-breaker", () => {
		expect(buildProductListOrder(ProductListQuerySchema.parse({ sort: "-price,name" }))).toEqual({
			orderBy: [{ price: "desc" }, { name: "asc" }, { id: "asc" }],
			isDefault: false,
		});
		expect(buildProductListOrder(ProductListQuerySchema.parse({}))).toEqual({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true });
	});
});

describe("sample category", () => {
	it("appends the tie-breaker to a non-unique sort", () => {
		expect(buildSampleCategoryListOrder(SampleCategoryListQuerySchema.parse({ sort: "sortOrder" })).orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
	});
});

describe("admin users", () => {
	it("maps the derived status filter to isActive / lockedUntil at the given instant", () => {
		const active = buildAdminUserListWhere(AdminUserListQuerySchema.parse({ filter: { status: "active" } }), NOW);
		expect(active).toEqual({ AND: [{ isActive: true, OR: [{ lockedUntil: null }, { lockedUntil: { lte: NOW } }] }] });
		const locked = buildAdminUserListWhere(AdminUserListQuerySchema.parse({ filter: { status: "locked" }, search: "ann" }), NOW);
		expect(locked).toEqual({
			AND: [{ OR: [{ fullName: { contains: "ann", mode: "insensitive" } }, { email: { contains: "ann", mode: "insensitive" } }] }, { lockedUntil: { gt: NOW } }],
		});
		expect(buildAdminUserListWhere(AdminUserListQuerySchema.parse({ filter: { status: "inactive", role: "Editor" } }), NOW)).toEqual({
			AND: [{ isActive: false, bannedAt: null }, { userRoles: { some: { isDeleted: false, role: { name: "Editor", isDeleted: false } } } }],
		});
		expect(buildAdminUserListWhere(AdminUserListQuerySchema.parse({ filter: { status: "banned" } }), NOW)).toEqual({ AND: [{ bannedAt: { not: null } }] });
	});

	it("sorts by name with a tie-breaker", () => {
		expect(buildAdminUserListOrder(AdminUserListQuerySchema.parse({ sort: "fullName" })).orderBy).toEqual([{ fullName: "asc" }, { id: "asc" }]);
	});
});

describe("admin merchants", () => {
	it("maps the public status to lifecycle states and keeps profile filters separate", () => {
		const query = AdminMerchantListQuerySchema.parse({ filter: { status: { in: "ONBOARDING,SUSPENDED" }, kybStatus: "PENDING", city: "MELAKA" } });
		expect(buildAdminMerchantListWhere(query)).toEqual({
			AND: [
				{ isDeleted: false, merchantProfile: { isNot: null } },
				{ merchantProfile: { is: { city: { equals: "MELAKA" } } } },
				{ merchantProfile: { is: { kybStatus: { equals: "PENDING" } } } },
				{ lifecycleState: { in: ["PROVISIONING", "SUSPENDED"] } },
			],
		});
		expect(buildAdminMerchantListOrder(AdminMerchantListQuerySchema.parse({ sort: "displayName" })).orderBy).toEqual([{ displayName: "asc" }, { id: "asc" }]);
	});
});

describe("admin location requests", () => {
	it("is a FIFO queue by default and filters by status", () => {
		const query = AdminLocationRequestListQuerySchema.parse({ filter: { status: "PENDING_APPROVAL" } });
		expect(buildAdminLocationRequestListWhere(query)).toEqual({ AND: [{ isDeleted: false, isPrimary: false }, { status: { equals: "PENDING_APPROVAL" } }] });
		expect(buildAdminLocationRequestListOrder(query)).toEqual({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], isDefault: true });
	});
});

describe("MFA recovery requests", () => {
	it("filters by status and user and orders newest request first", () => {
		const query = AdminMfaRecoveryListQuerySchema.parse({ filter: { status: { in: "PENDING,APPROVED" }, userId: USER_ID } });
		expect(buildMfaRecoveryListWhere(query)).toEqual({ AND: [{ status: { in: ["PENDING", "APPROVED"] } }, { userId: { equals: USER_ID } }] });
		expect(buildMfaRecoveryListOrder(query).orderBy).toEqual([{ requestedAt: "desc" }, { id: "desc" }]);
	});
});

describe("audit and email logs", () => {
	it("orders audit entries newest first with a tie-breaker", () => {
		expect(buildAuditLogListOrder(AuditLogQuerySchema.parse({})).orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
	});

	it("filters and searches email logs", () => {
		const query = EmailLogListQuerySchema.parse({ search: "welcome", sort: "-status", filter: { status: { in: "bounced,failed" }, createdAt: { gte: "1" } } });
		expect(buildEmailLogListWhere(query)).toEqual({
			AND: [
				{ status: { in: ["bounced", "failed"] } },
				{ createdAt: { gte: 1 } },
				{
					OR: [
						{ to: { contains: "welcome", mode: "insensitive" } },
						{ subject: { contains: "welcome", mode: "insensitive" } },
						{ templateKey: { contains: "welcome", mode: "insensitive" } },
					],
				},
			],
		});
		expect(buildEmailLogListOrder(query).orderBy).toEqual([{ status: "desc" }, { id: "desc" }]);
	});
});

describe("rewards", () => {
	it("only lists live consumer rewards of operating merchants in the marketplace, filtering city through the merchant profile and by merchant", () => {
		const query = RewardListQuerySchema.parse({ filter: { category: "cafe", city: { in: "MELAKA" } } });
		expect(buildMarketplaceWhere(query, NOW)).toEqual({
			AND: [
				{ isDeleted: false, status: "PUBLISHED", rewardKind: "CONSUMER", quantityRemaining: { gt: 0 }, expiryDate: { gte: NOW } },
				{ tenant: { isDeleted: false, lifecycleState: "ACTIVE" } },
				{ category: { equals: "cafe" } },
				{ tenant: { merchantProfile: { city: { in: ["MELAKA"] } } } },
			],
		});
		expect(buildMarketplaceWhere(RewardListQuerySchema.parse({ filter: { tenantId: ORG_ID } }), NOW).AND).toContainEqual({ tenantId: { equals: ORG_ID } });
		expect(buildMarketplaceOrder(RewardListQuerySchema.parse({ sort: "expiryDate" })).orderBy).toEqual([{ expiryDate: "asc" }, { id: "asc" }]);
		const selected = Object.keys(MARKETPLACE_REWARD_SELECT);
		expect(selected).toContain("title");
		expect(selected).toContain("images");
		expect(selected).toContain("locationScopes");
		for (const column of [
			"createdBy",
			"updatedBy",
			"deletedBy",
			"metadata",
			"parentConsumerRewardId",
			"submittedForReviewAt",
			"autoPublishAt",
			"reviewedAt",
			"reviewedByUserId",
			"rejectionReason",
		]) {
			expect(selected).not.toContain(column);
		}
	});

	it("scopes claims, notifications and redemptions to their owner", () => {
		expect(buildRewardClaimListWhere(USER_ID, RewardClaimListQuerySchema.parse({ filter: { status: "PENDING" } }))).toEqual({
			AND: [{ userId: USER_ID, isDeleted: false }, { status: { equals: "PENDING" } }],
		});
		expect(buildRewardClaimListOrder(RewardClaimListQuerySchema.parse({})).orderBy).toEqual([{ claimedAt: "desc" }, { id: "desc" }]);
		expect(buildRewardNotificationListWhere(USER_ID, RewardNotificationListQuerySchema.parse({ filter: { readAt: { isNull: "true" } } }))).toEqual({
			AND: [{ userId: USER_ID, isDeleted: false }, { readAt: { equals: null } }],
		});
		expect(buildRedemptionListWhere(ALL_STORES, MerchantRedemptionListQuerySchema.parse({}))).toEqual({
			AND: [{ tenantId: ORG_ID, isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } }],
		});
		expect(buildRedemptionListWhere(selectedStores([CATEGORY_ID]), MerchantRedemptionListQuerySchema.parse({})).AND).toContainEqual({
			locationId: { in: [CATEGORY_ID] },
		});
		// A store-limited member with no stores sees nothing — never every store.
		expect(buildRedemptionListWhere(selectedStores([]), MerchantRedemptionListQuerySchema.parse({})).AND).toContainEqual({ locationId: { in: [] } });
		// "Redeemed today": the window filter is applied server-side, so `meta.total` counts the whole window, not one page.
		expect(
			buildRedemptionListWhere(ALL_STORES, MerchantRedemptionListQuerySchema.parse({ filter: { redeemedAt: { gte: "1790899200000", lt: "1790985600000" } } })).AND,
		).toContainEqual({ redeemedAt: { gte: 1790899200000, lt: 1790985600000 } });
		expect(buildRedemptionListOrder(MerchantRedemptionListQuerySchema.parse({})).orderBy).toEqual([{ redeemedAt: "desc" }, { id: "desc" }]);
	});
});
