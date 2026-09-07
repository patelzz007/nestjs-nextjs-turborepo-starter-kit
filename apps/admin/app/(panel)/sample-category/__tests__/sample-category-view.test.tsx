import { describe, expect, it } from "vitest";

import SampleCategoryView from "../sample-category-view.generated";

describe("SampleCategoryView", () => {
	it("exports a default view component", () => {
		expect(SampleCategoryView).toBeDefined();
		expect(typeof SampleCategoryView).toBe("function");
	});
});
