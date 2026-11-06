import { describe, expect, it } from "vitest";

import { appRoute } from "../app-route";

describe("appRoute", () => {
	it("returns the path unchanged", () => {
		expect(appRoute("/dashboard/wallet?tab=active")).toBe("/dashboard/wallet?tab=active");
	});

	it("refuses an empty path", () => {
		expect(() => appRoute("")).toThrow("A route cannot be empty");
	});
});
