import type { OrganizationLocationScopeType, OrganizationLocationStatus, OrganizationMembershipRole, PilotCity } from "@prisma/client";

import { deterministicUuid } from "./deterministic-uuid";
import type { ProductSeedRow } from "./products";
import { SeededRandom } from "./prng";

// ---------------------------------------------------------------------------
// `enterprise` scenario dataset — a PURE builder (no Prisma access) so the
// exact rows a seed produces can be unit-tested.
//
// Determinism contract:
//   • Structure (ids, emails, codes, SKUs, which member has which role and
//     which location) depends only on the dataset SIZES — never on --seed.
//     Re-running with another --seed therefore updates the same rows in place
//     instead of piling up a second tenant.
//   • Attributes (names, phones, addresses, prices, stock, dates) come from
//     the seeded PRNG — the same --seed always produces identical values.
//   • Timestamps are offsets from a FIXED epoch, never `Date.now()`.
// ---------------------------------------------------------------------------

/** Anchor for every generated timestamp: 2026-01-01T00:00:00.000Z. */
export const ENTERPRISE_SEED_EPOCH_MS = 1_767_225_600_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Namespace for {@link deterministicUuid} — keeps enterprise ids disjoint from other seeders. */
const ID_NAMESPACE = "enterprise-seed";

export const ENTERPRISE_ORGANIZATION_SLUG = "northwind-enterprise";
export const ENTERPRISE_EMAIL_DOMAIN = "enterprise.example.com";
export const ENTERPRISE_OWNER_EMAIL = `owner@${ENTERPRISE_EMAIL_DOMAIN}`;

export interface EnterpriseDatasetSizes {
	/** Organization locations (each gets a 1:1 store via seedStores). */
	readonly locations: number;
	/** Organization members, INCLUDING the owner. */
	readonly members: number;
	readonly products: number;
}

/** Sized to finish in well under a minute on a laptop Postgres. */
export const ENTERPRISE_DATASET_SIZES: EnterpriseDatasetSizes = {
	locations: 25,
	members: 250,
	products: 500,
};

/** Every Nth member (after the owner and policy admin) is an org ADMIN covering all locations. */
const ADMIN_EVERY_NTH_MEMBER = 25;
/** Every Nth remaining member is a back-office MEMBER; the rest are CASHIERs. */
const BACK_OFFICE_EVERY_NTH_MEMBER = 4;
/** Member index 1 holds the POLICY_ADMIN role. */
const POLICY_ADMIN_MEMBER_INDEX = 1;
/** Every Nth location (1-based) is still awaiting approval, to exercise non-ACTIVE stores. */
const PENDING_LOCATION_EVERY_NTH = 10;

const MAX_MEMBER_TENURE_DAYS = 720;
const MAX_LOCATION_AGE_DAYS = 900;
const MAX_PRODUCT_AGE_DAYS = 365;
const MIN_STREET_NUMBER = 1;
const MAX_STREET_NUMBER = 250;
const MALAYSIA_MOBILE_MIN = 100_000_000;
const MALAYSIA_MOBILE_MAX = 199_999_999;
const MIN_PRICE_CENTS = 199;
const MAX_PRICE_CENTS = 49_999;
const MIN_COMPARE_AT_MARKUP_CENTS = 100;
const MAX_COMPARE_AT_MARKUP_CENTS = 5_000;
const MAX_STOCK_QUANTITY = 500;
const MIN_WEIGHT_GRAMS = 50;
const MAX_WEIGHT_GRAMS = 5_000;
const COMPARE_AT_PROBABILITY = 0.25;
const ACTIVE_PRODUCT_PROBABILITY = 0.92;
const FEATURED_PRODUCT_PROBABILITY = 0.08;
const CENTS_PER_UNIT = 100;
const CENTS_DIGITS = 2;
const CODE_PAD_WIDTH = 3;
const MEMBER_PAD_WIDTH = 4;
const SKU_PAD_WIDTH = 5;

const OWNER_FULL_NAME = "Nadia Rahman";

const FIRST_NAMES: readonly string[] = [
	"Aisyah",
	"Arjun",
	"Chen",
	"Daniel",
	"Farah",
	"Hafiz",
	"Jia Hui",
	"Kavitha",
	"Lim",
	"Mei Ling",
	"Muthu",
	"Nurul",
	"Priya",
	"Rizal",
	"Siti",
	"Tan",
	"Wei Jie",
	"Yusof",
	"Zara",
	"Hannah",
];
const LAST_NAMES: readonly string[] = [
	"Abdullah",
	"Chong",
	"Das",
	"Goh",
	"Hassan",
	"Ismail",
	"Krishnan",
	"Lee",
	"Menon",
	"Ng",
	"Omar",
	"Ramasamy",
	"Salleh",
	"Teo",
	"Wong",
	"Yap",
];
const STREET_NAMES: readonly string[] = [
	"Jalan Ampang",
	"Jalan Tun Razak",
	"Jalan Sultan Ismail",
	"Jalan Hang Tuah",
	"Jalan Merdeka",
	"Jalan Bunga Raya",
	"Jalan Tun Perak",
	"Jalan Melaka Raya",
];
const NEIGHBOURHOODS_BY_CITY: Readonly<Record<PilotCity, readonly string[]>> = {
	KUALA_LUMPUR: ["Bukit Bintang", "Bangsar", "Mont Kiara", "Cheras", "Kepong", "Setapak", "Sentul", "Titiwangsa", "Brickfields", "Damansara"],
	MELAKA: ["Bukit Katil", "Ayer Keroh", "Klebang", "Bukit Beruang", "Batu Berendam", "Jonker Walk"],
};
const CITIES: readonly PilotCity[] = ["KUALA_LUMPUR", "MELAKA"];
const PRODUCT_BRANDS: readonly string[] = ["Northwind", "Harbour & Co", "Kampung Craft", "Selatan", "Straits Supply", "Tropika"];
const PRODUCT_ADJECTIVES: readonly string[] = ["Classic", "Organic", "Premium", "Everyday", "Artisan", "Compact", "Deluxe", "Fresh"];
const PRODUCT_NOUNS: readonly string[] = ["Coffee Beans", "Tea Blend", "Kaya Jar", "Tote Bag", "Water Bottle", "Snack Box", "Gift Card", "Travel Mug", "Spice Kit", "Candle"];

export interface EnterpriseOrganizationRow {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly legalName: string;
	readonly category: string;
	readonly city: PilotCity;
	readonly addressText: string;
	readonly contactEmail: string;
	readonly contactPhone: string;
	readonly entitlementId: string;
	readonly createdAt: bigint;
}

export interface EnterpriseLocationRow {
	readonly id: string;
	readonly name: string;
	readonly code: string;
	readonly addressText: string;
	readonly city: PilotCity;
	readonly contactPhone: string;
	readonly status: OrganizationLocationStatus;
	readonly isPrimary: boolean;
	readonly createdAt: bigint;
}

export type EnterpriseMemberScope =
	| { readonly id: string; readonly scopeType: Extract<OrganizationLocationScopeType, "ALL_LOCATIONS"> }
	| { readonly id: string; readonly scopeType: Extract<OrganizationLocationScopeType, "SELECTED">; readonly locationId: string };

export interface EnterpriseMemberRow {
	readonly userId: string;
	readonly membershipId: string;
	readonly email: string;
	readonly fullName: string;
	readonly phone: string;
	readonly role: OrganizationMembershipRole;
	readonly scope: EnterpriseMemberScope;
	readonly joinedAt: bigint;
}

export interface EnterpriseDataset {
	readonly organization: EnterpriseOrganizationRow;
	readonly locations: readonly EnterpriseLocationRow[];
	readonly members: readonly EnterpriseMemberRow[];
	readonly products: readonly ProductSeedRow[];
}

export interface BuildEnterpriseDatasetInput {
	readonly seed: number;
	readonly sizes: EnterpriseDatasetSizes;
	/** Existing category ids products are distributed across (must be non-empty). */
	readonly categoryIds: readonly string[];
}

export class InvalidEnterpriseDatasetError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "InvalidEnterpriseDatasetError";
	}
}

function enterpriseId(key: string): string {
	return deterministicUuid(ID_NAMESPACE, key);
}

function epochMinusDays(days: number): bigint {
	return BigInt(ENTERPRISE_SEED_EPOCH_MS - days * DAY_MS);
}

function padIndex(value: number, width: number): string {
	return String(value).padStart(width, "0");
}

function formatCents(cents: number): string {
	const units = Math.floor(cents / CENTS_PER_UNIT);
	const remainder = cents % CENTS_PER_UNIT;
	return `${String(units)}.${padIndex(remainder, CENTS_DIGITS)}`;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function mobilePhone(random: SeededRandom): string {
	return `+60${String(random.int(MALAYSIA_MOBILE_MIN, MALAYSIA_MOBILE_MAX))}`;
}

function assertSizes(sizes: EnterpriseDatasetSizes, categoryIds: readonly string[]): void {
	const counts: readonly [label: string, value: number][] = [
		["locations", sizes.locations],
		["members", sizes.members],
		["products", sizes.products],
	];
	for (const [label, value] of counts) {
		if (!Number.isSafeInteger(value) || value < 1) {
			throw new InvalidEnterpriseDatasetError(`Enterprise dataset needs at least one ${label} (received ${String(value)})`);
		}
	}
	if (categoryIds.length === 0) {
		throw new InvalidEnterpriseDatasetError("Enterprise dataset needs at least one product category id");
	}
}

function buildOrganization(): EnterpriseOrganizationRow {
	return {
		id: enterpriseId("organization"),
		slug: ENTERPRISE_ORGANIZATION_SLUG,
		displayName: "Northwind Retail Group",
		legalName: "Northwind Retail Group Sdn Bhd",
		category: "retail",
		city: "KUALA_LUMPUR",
		addressText: "1 Jalan Ampang, 50450 Kuala Lumpur",
		contactEmail: ENTERPRISE_OWNER_EMAIL,
		contactPhone: "+60320001000",
		entitlementId: enterpriseId("entitlement"),
		createdAt: BigInt(ENTERPRISE_SEED_EPOCH_MS - MAX_LOCATION_AGE_DAYS * DAY_MS),
	};
}

function locationStatusAt(index: number): OrganizationLocationStatus {
	return (index + 1) % PENDING_LOCATION_EVERY_NTH === 0 ? "PENDING_APPROVAL" : "ACTIVE";
}

/** Location ids by index — structural, so they never depend on the PRNG. */
export function buildEnterpriseLocationId(index: number): string {
	return enterpriseId(`location:${String(index)}`);
}

function buildLocations(seed: number, count: number): EnterpriseLocationRow[] {
	const random = SeededRandom.derive(seed, "locations");
	return Array.from({ length: count }, (_, index): EnterpriseLocationRow => {
		const city = random.pick(CITIES);
		const neighbourhood = random.pick(NEIGHBOURHOODS_BY_CITY[city]);
		const code = `store-${padIndex(index + 1, CODE_PAD_WIDTH)}`;
		return {
			id: buildEnterpriseLocationId(index),
			name: `Northwind — ${neighbourhood} (${code})`,
			code,
			addressText: `${String(random.int(MIN_STREET_NUMBER, MAX_STREET_NUMBER))} ${random.pick(STREET_NAMES)}, ${neighbourhood}`,
			city,
			contactPhone: mobilePhone(random),
			status: locationStatusAt(index),
			isPrimary: index === 0,
			createdAt: epochMinusDays(random.int(0, MAX_LOCATION_AGE_DAYS)),
		};
	});
}

/** Role by member index — structural (see determinism contract above). */
export function enterpriseMemberRoleAt(memberIndex: number): OrganizationMembershipRole {
	if (memberIndex === 0) return "OWNER";
	if (memberIndex === POLICY_ADMIN_MEMBER_INDEX) return "POLICY_ADMIN";
	if (memberIndex % ADMIN_EVERY_NTH_MEMBER === 0) return "ADMIN";
	if (memberIndex % BACK_OFFICE_EVERY_NTH_MEMBER === 0) return "MEMBER";
	return "CASHIER";
}

const ALL_LOCATION_ROLES: ReadonlySet<OrganizationMembershipRole> = new Set<OrganizationMembershipRole>(["OWNER", "ADMIN", "POLICY_ADMIN"]);

function memberScope(memberIndex: number, role: OrganizationMembershipRole, locations: readonly EnterpriseLocationRow[]): EnterpriseMemberScope {
	const id = enterpriseId(`membership-scope:${String(memberIndex)}`);
	if (ALL_LOCATION_ROLES.has(role)) {
		return { id, scopeType: "ALL_LOCATIONS" };
	}
	const location = locations.at((memberIndex - 1) % locations.length);
	if (location === undefined) {
		throw new InvalidEnterpriseDatasetError(`No location available for member ${String(memberIndex)}`);
	}
	return { id, scopeType: "SELECTED", locationId: location.id };
}

function buildMembers(seed: number, count: number, locations: readonly EnterpriseLocationRow[]): EnterpriseMemberRow[] {
	const random = SeededRandom.derive(seed, "members");
	return Array.from({ length: count }, (_, memberIndex): EnterpriseMemberRow => {
		const role = enterpriseMemberRoleAt(memberIndex);
		const generatedName = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
		return {
			userId: enterpriseId(`user:${String(memberIndex)}`),
			membershipId: enterpriseId(`membership:${String(memberIndex)}`),
			email: memberIndex === 0 ? ENTERPRISE_OWNER_EMAIL : `member.${padIndex(memberIndex, MEMBER_PAD_WIDTH)}@${ENTERPRISE_EMAIL_DOMAIN}`,
			fullName: memberIndex === 0 ? OWNER_FULL_NAME : generatedName,
			phone: mobilePhone(random),
			role,
			scope: memberScope(memberIndex, role, locations),
			joinedAt: epochMinusDays(random.int(0, MAX_MEMBER_TENURE_DAYS)),
		};
	});
}

function buildProducts(seed: number, count: number, categoryIds: readonly string[]): ProductSeedRow[] {
	const random = SeededRandom.derive(seed, "products");
	const updatedAt = BigInt(ENTERPRISE_SEED_EPOCH_MS);
	return Array.from({ length: count }, (_, index): ProductSeedRow => {
		const sku = `ENT-${padIndex(index + 1, SKU_PAD_WIDTH)}`;
		const brand = random.pick(PRODUCT_BRANDS);
		const name = `${brand} ${random.pick(PRODUCT_ADJECTIVES)} ${random.pick(PRODUCT_NOUNS)}`;
		const priceCents = random.int(MIN_PRICE_CENTS, MAX_PRICE_CENTS);
		const hasCompareAt = random.chance(COMPARE_AT_PROBABILITY);
		const compareAtCents = priceCents + random.int(MIN_COMPARE_AT_MARKUP_CENTS, MAX_COMPARE_AT_MARKUP_CENTS);
		return {
			id: enterpriseId(`product:${String(index)}`),
			sku,
			name,
			slug: `${slugify(name)}-${sku.toLowerCase()}`,
			shortDescription: `${brand} enterprise catalog item ${sku}.`,
			description: `${name} — generated enterprise catalog item for load, pagination, and search testing.`,
			price: formatCents(priceCents),
			compareAtPrice: hasCompareAt ? formatCents(compareAtCents) : null,
			stockQuantity: random.int(0, MAX_STOCK_QUANTITY),
			categoryId: random.pick(categoryIds),
			brand,
			weightGrams: random.int(MIN_WEIGHT_GRAMS, MAX_WEIGHT_GRAMS),
			imageUrl: null,
			isActive: random.chance(ACTIVE_PRODUCT_PROBABILITY),
			isFeatured: random.chance(FEATURED_PRODUCT_PROBABILITY),
			version: 0,
			createdAt: epochMinusDays(random.int(0, MAX_PRODUCT_AGE_DAYS)),
			updatedAt,
		};
	});
}

/** Builds the complete enterprise dataset for `seed`. Pure — safe to call in unit tests. */
export function buildEnterpriseDataset(input: BuildEnterpriseDatasetInput): EnterpriseDataset {
	assertSizes(input.sizes, input.categoryIds);
	const organization = buildOrganization();
	const locations = buildLocations(input.seed, input.sizes.locations);
	const members = buildMembers(input.seed, input.sizes.members, locations);
	const products = buildProducts(input.seed, input.sizes.products, input.categoryIds);
	return { organization, locations, members, products };
}
