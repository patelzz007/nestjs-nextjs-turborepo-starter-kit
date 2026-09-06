import { describe, expect, it } from "vitest";

import { insertBeforeAnchor } from "./patch-insert.js";

describe("insertBeforeAnchor", () => {
	it("inserts a block before the anchor with a single comma", () => {
		const source = "export const tree = {\n\trewards: {},\n} as const;";
		const next = insertBeforeAnchor(source, "\n} as const;", "\tgenerated: {},");
		expect(next).toBe("export const tree = {\n\trewards: {},\n\tgenerated: {},\n} as const;");
	});
});
