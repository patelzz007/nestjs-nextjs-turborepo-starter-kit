import { describe, expect, it } from "vitest";

import ProductView from "../product-view.generated";

describe("ProductView", () => {
	it("exports a default view component", () => {
		expect(ProductView).toBeDefined();
		expect(typeof ProductView).toBe("function");
	});
});
