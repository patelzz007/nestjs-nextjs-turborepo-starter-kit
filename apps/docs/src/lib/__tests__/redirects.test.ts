import { describe, expect, it } from "vitest";

import { redirectTarget, redirectTargetIn } from "../redirects";

const REDIRECTS = [{ from: "/docs/old", to: "/docs/new" }];

describe("redirectTargetIn", () => {
	it("finds where an old address moved to", () => {
		expect(redirectTargetIn(REDIRECTS, "/docs/old")).toBe("/docs/new");
	});

	it("answers null for an address that did not move", () => {
		expect(redirectTargetIn(REDIRECTS, "/docs/new")).toBeNull();
	});
});

describe("redirectTarget", () => {
	it("reads the generated list", () => {
		expect(redirectTarget("/docs/not-a-moved-page")).toBeNull();
	});
});
