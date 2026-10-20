import type { SampleCategory } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { SampleCategoryEntity } from "../entities/sample-category.entity";

const CATEGORY: SampleCategory = {
	id: "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d",
	description: null,
	isActive: true,
	name: "Mugs",
	slug: "mugs",
	sortOrder: 1,
	version: 2,
	deletedAt: null,
	createdAt: 1_792_195_200_000,
	updatedAt: 1_792_195_200_000,
};

describe("SampleCategoryEntity", () => {
	it("carries the stored version as the concurrency token", () => {
		const entity = SampleCategoryEntity.rehydrate(CATEGORY);
		expect(entity.concurrencyToken).toBe(2);
		expect(entity.toRecord()).toEqual(CATEGORY);
	});

	it("treats a different version as a different token", () => {
		const current = SampleCategoryEntity.rehydrate(CATEGORY);
		const next = SampleCategoryEntity.rehydrate({ ...CATEGORY, version: 3 });
		expect(current.equals(SampleCategoryEntity.rehydrate(CATEGORY))).toBe(true);
		expect(current.equals(next)).toBe(false);
	});
});
