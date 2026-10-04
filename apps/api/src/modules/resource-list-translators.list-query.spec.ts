// Per-resource list translators: the validated list query (sort + filter AST +
// search) → the exact Prisma `where` / `orderBy` each repository sends. Every
// order ends with the unique `id` tie-breaker so offset pages are stable.

import {
	AdminLocationRequestListQuerySchema,
	AdminMerchantListQuerySchema,
	AdminMfaRecoveryListQuerySchema,
	AdminUserListQuerySchema,
	AuditLogQuerySchema,
	CityListQuerySchema,
	CountryListQuerySchema,
	RegionListQuerySchema,
	StateListQuerySchema,
	SubregionListQuerySchema,
	EmailLogListQuerySchema,
	ProductListQuerySchema,
	RewardClaimListQuerySchema,
	RewardListQuerySchema,
	RewardNotificationListQuerySchema,
	SampleCategoryListQuerySchema,
	MerchantRedemptionListQuerySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildAdminUserListOrder, buildAdminUserListWhere } from "./auth/repositories/user.repository";
import { buildMfaRecoveryListOrder, buildMfaRecoveryListWhere } from "./auth/services/mfa-recovery.service";
import { buildAuditLogListOrder } from "./authorization/admin/repositories/permission-audit-log.repository";
import { buildCityListWhere, buildCountryListWhere, buildRegionListWhere, buildStateListWhere, buildSubregionListWhere } from "./geo/repositories/geo.repository";
import { buildEmailLogListOrder, buildEmailLogListWhere } from "./notifications/email/email-log.repository";
import { buildAdminLocationRequestListOrder, buildAdminLocationRequestListWhere } from "./organization/repositories/organization-location.repository";
import { buildAdminMerchantListOrder, buildAdminMerchantListWhere } from "./organization/repositories/organization.repository";
import { buildProductListOrder, buildProductListWhere } from "./product/product.repository";
import { buildRewardClaimListOrder, buildRewardClaimListWhere } from "./rewards/repositories/reward-claim.repository";
import { buildRewardNotificationListWhere } from "./rewards/repositories/reward-notification.repository";
import { buildRedemptionListOrder, buildRedemptionListWhere } from "./rewards/repositories/reward-redemption.repository";
import { buildMarketplaceOrder, buildMarketplaceWhere } from "./rewards/repositories/reward.repository";
import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "./rewards/types/merchant-location-scope";
import { buildSampleCategoryListOrder } from "./sample-category/sample-category.repository";

const NOW = BigInt(1_790_812_800_000);
const USER_ID = "6f1c2a52-9a3e-4d38-9a55-0d1e2f3a4b5c";
const ORG_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";
const CATEGORY_ID = "8b3e4c74-1c50-4f5a-9c77-2f3a4b5c6d7e";

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

describe("geo cities", () => {
	it("excludes soft-deleted rows, narrows to fuzzy-search ids and maps code filters case-insensitively", () => {
		const query = CityListQuerySchema.parse({ filter: { countryCode: { eq: "my" }, stateId: { in: "1,2" } } });
		expect(buildCityListWhere(query, [3, 4])).toEqual({
			AND: [{ isDeleted: false }, { stateId: { in: [1, 2] } }, { countryCode: { equals: "my", mode: "insensitive" } }, { id: { in: [3, 4] } }],
		});
	});

	it("excludes soft-deleted rows in every geo list, even without filters", () => {
		expect(buildRegionListWhere(RegionListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildSubregionListWhere(SubregionListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildCountryListWhere(CountryListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildStateListWhere(StateListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildCityListWhere(CityListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
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
			AND: [{ isActive: false }, { userRoles: { some: { isDeleted: false, role: { name: "Editor", isDeleted: false } } } }],
		});
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
	it("only lists live consumer rewards in the marketplace and filters city through the merchant profile", () => {
		const query = RewardListQuerySchema.parse({ filter: { category: "cafe", city: { in: "MELAKA" } } });
		expect(buildMarketplaceWhere(query, NOW)).toEqual({
			AND: [
				{ isDeleted: false, status: "PUBLISHED", rewardKind: "CONSUMER", quantityRemaining: { gt: 0 }, expiryDate: { gte: NOW } },
				{ category: { equals: "cafe" } },
				{ organization: { merchantProfile: { city: { in: ["MELAKA"] } } } },
			],
		});
		expect(buildMarketplaceOrder(RewardListQuerySchema.parse({ sort: "expiryDate" })).orderBy).toEqual([{ expiryDate: "asc" }, { id: "asc" }]);
	});

	it("scopes claims, notifications and redemptions to their owner", () => {
		expect(buildRewardClaimListWhere(USER_ID, RewardClaimListQuerySchema.parse({ filter: { status: "PENDING" } }))).toEqual({
			AND: [{ userId: USER_ID, isDeleted: false }, { status: { equals: "PENDING" } }],
		});
		expect(buildRewardClaimListOrder(RewardClaimListQuerySchema.parse({})).orderBy).toEqual([{ claimedAt: "desc" }, { id: "desc" }]);
		expect(buildRewardNotificationListWhere(USER_ID, RewardNotificationListQuerySchema.parse({ filter: { readAt: { isNull: "true" } } }))).toEqual({
			AND: [{ userId: USER_ID, isDeleted: false }, { readAt: { equals: null } }],
		});
		expect(buildRedemptionListWhere(ORG_ID, ALL_LOCATIONS_SCOPE, MerchantRedemptionListQuerySchema.parse({}))).toEqual({
			AND: [{ organizationId: ORG_ID, isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } }],
		});
		expect(buildRedemptionListWhere(ORG_ID, selectedLocationsScope([CATEGORY_ID]), MerchantRedemptionListQuerySchema.parse({})).AND).toContainEqual({
			locationId: { in: [CATEGORY_ID] },
		});
		// A store-limited member with no stores sees nothing — never every store.
		expect(buildRedemptionListWhere(ORG_ID, selectedLocationsScope([]), MerchantRedemptionListQuerySchema.parse({})).AND).toContainEqual({ locationId: { in: [] } });
		// "Redeemed today": the window filter is applied server-side, so `meta.total` counts the whole window, not one page.
		expect(
			buildRedemptionListWhere(ORG_ID, ALL_LOCATIONS_SCOPE, MerchantRedemptionListQuerySchema.parse({ filter: { redeemedAt: { gte: "1790899200000", lt: "1790985600000" } } }))
				.AND,
		).toContainEqual({ redeemedAt: { gte: 1790899200000, lt: 1790985600000 } });
		expect(buildRedemptionListOrder(MerchantRedemptionListQuerySchema.parse({})).orderBy).toEqual([{ redeemedAt: "desc" }, { id: "desc" }]);
	});
});
