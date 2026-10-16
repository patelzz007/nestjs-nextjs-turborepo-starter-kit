import { API_VERSION_PREFIX, apiRoutes } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { posEndpointUrl } from "@/lib/pos/pos-endpoint-url";

describe("posEndpointUrl", () => {
	it("joins the API origin, the version prefix and the route", () => {
		expect(posEndpointUrl("https://api.example.com", apiRoutes.pos.pairTerminal)).toBe(`https://api.example.com${API_VERSION_PREFIX}/pos/terminals/pair`);
	});

	it("drops trailing slashes from the origin so the path never doubles up", () => {
		expect(posEndpointUrl("https://api.example.com//", "/redemptions/validate")).toBe(`https://api.example.com${API_VERSION_PREFIX}/redemptions/validate`);
	});
});
