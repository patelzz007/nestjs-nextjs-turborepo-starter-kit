import { describe, expect, it } from "vitest";

import { SampleCategoryRepository } from "../sample-category.repository";

describe("SampleCategoryRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(SampleCategoryRepository.prototype).toHaveProperty("list", expect.any(Function));
		expect(SampleCategoryRepository.prototype).toHaveProperty("findById", expect.any(Function));
	});

	it("exposes create and delete repository methods", () => {
		expect(SampleCategoryRepository.prototype).toHaveProperty("create", expect.any(Function));
		expect(SampleCategoryRepository.prototype).toHaveProperty("delete", expect.any(Function));
	});
});
