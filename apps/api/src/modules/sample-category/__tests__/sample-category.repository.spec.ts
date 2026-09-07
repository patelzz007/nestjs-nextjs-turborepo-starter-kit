import { describe, expect, it } from "vitest";

import { GeneratedSampleCategoryRepository } from "../sample-category.repository.generated";

describe("GeneratedSampleCategoryRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(GeneratedSampleCategoryRepository.prototype.list).toBeDefined();
		expect(GeneratedSampleCategoryRepository.prototype.findById).toBeDefined();
	});

	it("exposes create and delete repository methods", () => {
		expect(GeneratedSampleCategoryRepository.prototype.create).toBeDefined();
		expect(GeneratedSampleCategoryRepository.prototype.delete).toBeDefined();
	});
});
