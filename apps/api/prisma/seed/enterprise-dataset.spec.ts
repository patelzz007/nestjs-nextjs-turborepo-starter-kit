import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import {
	buildEnterpriseDataset,
	buildEnterpriseLocationId,
	ENTERPRISE_DATASET_SIZES,
	ENTERPRISE_OWNER_EMAIL,
	ENTERPRISE_SEED_EPOCH_MS,
	enterpriseMemberRoleAt,
	InvalidEnterpriseDatasetError,
	type EnterpriseDataset,
	type EnterpriseDatasetSizes,
} from "./enterprise-dataset";
import { InvalidRandomSeedError } from "./prng";

const SMALL_SIZES: EnterpriseDatasetSizes = { locations: 12, members: 60, products: 40 };
const CATEGORY_IDS: readonly string[] = ["category-a", "category-b", "category-c"];

function build(seed: number, sizes: EnterpriseDatasetSizes = SMALL_SIZES): EnterpriseDataset {
	return buildEnterpriseDataset({ seed, sizes, categoryIds: CATEGORY_IDS });
}

function structuralKeys(dataset: EnterpriseDataset): readonly string[] {
	return [
		dataset.organization.id,
		...dataset.locations.map((location) => `${location.id}|${location.code}|${location.status}|${String(location.isPrimary)}`),
		...dataset.members.map((member) => `${member.userId}|${member.membershipId}|${member.email}|${member.role}|${JSON.stringify(member.scope)}`),
		...dataset.products.map((product) => `${product.id}|${product.sku}`),
	];
}

describe("buildEnterpriseDataset", () => {
	it("is fully deterministic: the same seed yields identical data", () => {
		expect(build(123)).toEqual(build(123));
	});

	it("varies generated attributes with the seed", () => {
		const first = build(1);
		const second = build(2);
		expect(first.members.map((member) => member.fullName)).not.toEqual(second.members.map((member) => member.fullName));
		expect(first.products.map((product) => product.price)).not.toEqual(second.products.map((product) => product.price));
	});

	it("keeps structure (ids, emails, codes, roles, scopes, SKUs) independent of the seed so re-seeding updates rows in place", () => {
		expect(structuralKeys(build(1))).toEqual(structuralKeys(build(987_654)));
	});

	it("creates exactly the requested number of rows", () => {
		const dataset = build(5);
		expect(dataset.locations).toHaveLength(SMALL_SIZES.locations);
		expect(dataset.members).toHaveLength(SMALL_SIZES.members);
		expect(dataset.products).toHaveLength(SMALL_SIZES.products);
	});

	it("produces unique ids, emails, location codes, and SKUs", () => {
		const dataset = build(5);
		const unique = (values: readonly string[]): number => new Set(values).size;
		expect(unique(dataset.locations.map((location) => location.id))).toBe(SMALL_SIZES.locations);
		expect(unique(dataset.locations.map((location) => location.code))).toBe(SMALL_SIZES.locations);
		expect(unique(dataset.members.map((member) => member.userId))).toBe(SMALL_SIZES.members);
		expect(unique(dataset.members.map((member) => member.membershipId))).toBe(SMALL_SIZES.members);
		expect(unique(dataset.members.map((member) => member.scope.id))).toBe(SMALL_SIZES.members);
		expect(unique(dataset.members.map((member) => member.email))).toBe(SMALL_SIZES.members);
		expect(unique(dataset.products.map((product) => product.id))).toBe(SMALL_SIZES.products);
		expect(unique(dataset.products.map((product) => product.sku))).toBe(SMALL_SIZES.products);
	});

	it("has exactly one primary location, which is ACTIVE", () => {
		const primaries = build(5).locations.filter((location) => location.isPrimary);
		expect(primaries).toHaveLength(1);
		expect(primaries[LIST_SLOT_INDEX.first]?.status).toBe("ACTIVE");
	});

	it("marks every 10th location as pending approval", () => {
		const statuses = build(5).locations.map((location) => location.status);
		expect(statuses[LIST_SLOT_INDEX.tenth]).toBe("PENDING_APPROVAL");
		expect(statuses.filter((status) => status === "PENDING_APPROVAL")).toHaveLength(1);
	});

	it("makes member 0 the OWNER with the documented email and all-locations scope", () => {
		const owner = build(5).members[LIST_SLOT_INDEX.first];
		expect(owner?.email).toBe(ENTERPRISE_OWNER_EMAIL);
		expect(owner?.role).toBe("OWNER");
		expect(owner?.scope.scopeType).toBe("ALL_LOCATIONS");
	});

	it("scopes every SELECTED member to a location that exists in the dataset", () => {
		const dataset = build(5);
		const locationIds = new Set(dataset.locations.map((location) => location.id));
		const selected = dataset.members.filter((member) => member.scope.scopeType === "SELECTED");
		expect(selected.length).toBeGreaterThan(0);
		for (const member of selected) {
			expect(member.scope.scopeType === "SELECTED" && locationIds.has(member.scope.locationId)).toBe(true);
		}
	});

	it("assigns products only to the provided categories, with valid prices", () => {
		for (const product of build(5).products) {
			expect(CATEGORY_IDS).toContain(product.categoryId);
			expect(product.price).toMatch(/^\d+\.\d{2}$/);
			if (product.compareAtPrice !== null) {
				expect(Number(product.compareAtPrice)).toBeGreaterThan(Number(product.price));
			}
		}
	});

	it("derives every timestamp from the fixed epoch, never the wall clock", () => {
		const dataset = build(5);
		const timestamps = [
			dataset.organization.createdAt,
			...dataset.locations.map((location) => location.createdAt),
			...dataset.members.map((member) => member.joinedAt),
			...dataset.products.flatMap((product) => [product.createdAt, product.updatedAt]),
		];
		for (const timestamp of timestamps) {
			expect(timestamp).toBeLessThanOrEqual(BigInt(ENTERPRISE_SEED_EPOCH_MS));
		}
	});

	it("uses the default sizes documented for the scenario", () => {
		expect(ENTERPRISE_DATASET_SIZES).toEqual({ locations: 25, members: 250, products: 500 });
		const dataset = build(1, ENTERPRISE_DATASET_SIZES);
		expect(dataset.members.at(-1)?.email).toBe("member.0249@enterprise.example.com");
	});

	it("rejects empty sizes and missing categories", () => {
		expect(() => build(1, { locations: 0, members: 1, products: 1 })).toThrow(InvalidEnterpriseDatasetError);
		expect(() => build(1, { locations: 1, members: 1, products: 1.5 })).toThrow(InvalidEnterpriseDatasetError);
		expect(() => buildEnterpriseDataset({ seed: 1, sizes: SMALL_SIZES, categoryIds: [] })).toThrow(InvalidEnterpriseDatasetError);
	});

	it("rejects an invalid seed", () => {
		expect(() => build(-1)).toThrow(InvalidRandomSeedError);
	});
});

describe("enterpriseMemberRoleAt", () => {
	it.each([
		[0, "OWNER"],
		[1, "POLICY_ADMIN"],
		[2, "CASHIER"],
		[4, "MEMBER"],
		[25, "ADMIN"],
		[50, "ADMIN"],
		[100, "ADMIN"],
		[8, "MEMBER"],
		[9, "CASHIER"],
	])("member %i → %s", (index, role) => {
		expect(enterpriseMemberRoleAt(index)).toBe(role);
	});
});

describe("buildEnterpriseLocationId", () => {
	it("is stable per index and distinct across indexes", () => {
		expect(buildEnterpriseLocationId(3)).toBe(buildEnterpriseLocationId(3));
		expect(buildEnterpriseLocationId(3)).not.toBe(buildEnterpriseLocationId(4));
		expect(buildEnterpriseLocationId(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});
