import { describe, expect, it } from "vitest";

import { SampleCategoryRepository } from "../sample-category.repository";

describe("SampleCategoryRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(SampleCategoryRepository.prototype.list).toBeDefined();
		expect(SampleCategoryRepository.prototype.findById).toBeDefined();
	});

	it("exposes create and delete repository methods", () => {
		expect(SampleCategoryRepository.prototype.create).toBeDefined();
		expect(SampleCategoryRepository.prototype.delete).toBeDefined();
	});
});
