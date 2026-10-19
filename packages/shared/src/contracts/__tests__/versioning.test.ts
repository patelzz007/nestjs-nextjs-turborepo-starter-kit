import { describe, expect, it } from "vitest";

import { epochMs } from "../../schemas/api/common";
import { ApiVersionManifestSchema } from "../../schemas/api/version";
import { API_VERSION, sunsetHeaderValue } from "../versioning";

describe("sunsetHeaderValue", () => {
	it("writes the instant as the HTTP-date RFC 8594's Sunset header requires", () => {
		expect(sunsetHeaderValue(epochMs(Date.UTC(2026, 9, 18)))).toBe("Sun, 18 Oct 2026 00:00:00 GMT");
	});
});

describe("ApiVersionManifestSchema", () => {
	it("carries a deprecated version's sunset as epoch milliseconds, never a date string", () => {
		const manifest = {
			current: API_VERSION,
			default: API_VERSION,
			supported: [{ version: API_VERSION, sunsetAt: Date.UTC(2026, 9, 18) }],
			docs: "/v1/docs",
			prefix: "/api/v1",
		};

		expect(ApiVersionManifestSchema.safeParse(manifest).success).toBe(true);
		expect(ApiVersionManifestSchema.safeParse({ ...manifest, supported: [{ version: API_VERSION, sunsetAt: "2026-10-18" }] }).success).toBe(false);
	});
});
