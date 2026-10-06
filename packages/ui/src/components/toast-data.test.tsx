import { Gift } from "lucide-react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { toastDataSchema } from "./toast";

describe("toastDataSchema", () => {
	it("accepts a rendered icon element and a 0–100 progress", () => {
		expect(toastDataSchema.safeParse({ icon: <Gift />, progress: 40 }).success).toBe(true);
	});

	it("rejects an icon that is not a React element (it is checked, not cast)", () => {
		expect(toastDataSchema.safeParse({ icon: "gift" }).success).toBe(false);
		expect(toastDataSchema.safeParse({ icon: { type: "svg" } }).success).toBe(false);
	});
});
