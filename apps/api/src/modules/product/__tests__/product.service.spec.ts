import { describe, expect, it } from "vitest";

import { ProductService } from "../product.service";

describe("ProductService", () => {
	it("is defined", () => {
		expect(ProductService).toBeDefined();
	});
});
