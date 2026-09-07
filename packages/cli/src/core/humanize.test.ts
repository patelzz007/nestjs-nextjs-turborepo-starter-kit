import { describe, expect, it } from "vitest";

import { humanizeFieldLabel, pluralizeLabel } from "./humanize";

describe("humanize helpers", () => {
	it("humanizes camelCase field names", () => {
		expect(humanizeFieldLabel("stockQuantity")).toBe("Stock Quantity");
		expect(humanizeFieldLabel("isActive")).toBe("Is Active");
	});

	it("pluralizes common English labels", () => {
		expect(pluralizeLabel("category")).toBe("categories");
		expect(pluralizeLabel("box")).toBe("boxes");
		expect(pluralizeLabel("status")).toBe("statuses");
		expect(pluralizeLabel("match")).toBe("matches");
	});
});
