import { describe, expect, it } from "vitest";

import { clientInfoOf } from "../request-client-info";

describe("clientInfoOf", () => {
	it("reads the request IP and the raw User-Agent", () => {
		expect(clientInfoOf({ ip: "198.51.100.7", headers: { "user-agent": "Firefox on macOS" } })).toEqual({ ipAddress: "198.51.100.7", userAgent: "Firefox on macOS" });
	});

	it("answers null for a missing User-Agent", () => {
		expect(clientInfoOf({ ip: "198.51.100.7", headers: {} })).toEqual({ ipAddress: "198.51.100.7", userAgent: null });
	});
});
