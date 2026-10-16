import { describe, expect, it } from "vitest";

import { BooleanQueryParamSchema } from "./query-params";

describe("BooleanQueryParamSchema", () => {
	it("accepts boolean and string query values", () => {
		expect(BooleanQueryParamSchema.safeParse(true).data).toBe(true);
		expect(BooleanQueryParamSchema.safeParse(false).data).toBe(false);
		expect(BooleanQueryParamSchema.safeParse("true").data).toBe("true");
		expect(BooleanQueryParamSchema.safeParse("false").data).toBe("false");
	});
});
