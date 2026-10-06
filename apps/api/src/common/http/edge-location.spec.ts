import { describe, expect, it } from "vitest";

import { readEdgeLocation } from "./edge-location";

describe("readEdgeLocation", () => {
	it("reads CloudFront's viewer headers, preferring the region name over its code", () => {
		expect(
			readEdgeLocation({
				"cloudfront-viewer-country": "MY",
				"cloudfront-viewer-country-region": "10",
				"cloudfront-viewer-country-region-name": "Selangor",
				"cloudfront-viewer-city": "Shah Alam",
				"cloudfront-viewer-time-zone": "Asia/Kuala_Lumpur",
			}),
		).toEqual({ country: "MY", region: "Selangor", city: "Shah Alam", timeZone: "Asia/Kuala_Lumpur" });
	});

	it("reads Cloudflare's headers, keeping its Tor marker and dropping its 'unknown' country", () => {
		expect(readEdgeLocation({ "cf-ipcountry": "T1" })).toEqual({ country: "T1", region: undefined, city: undefined, timeZone: undefined });
		expect(readEdgeLocation({ "cf-ipcountry": "XX", "cf-ipcity": "Singapore" })).toEqual({ country: undefined, region: undefined, city: "Singapore", timeZone: undefined });
	});

	it("decodes Vercel's percent-encoded city", () => {
		expect(readEdgeLocation({ "x-vercel-ip-country": "my", "x-vercel-ip-city": "Kuala%20Lumpur", "x-vercel-ip-timezone": "Asia/Kuala_Lumpur" })).toEqual({
			country: "MY",
			region: undefined,
			city: "Kuala Lumpur",
			timeZone: "Asia/Kuala_Lumpur",
		});
	});

	it("uses the first CDN present (CloudFront before Cloudflare)", () => {
		expect(readEdgeLocation({ "cloudfront-viewer-country": "SG", "cf-ipcountry": "MY" })?.country).toBe("SG");
	});

	it("rejects malformed values instead of storing them", () => {
		expect(readEdgeLocation({ "cloudfront-viewer-country": "Malaysia", "cloudfront-viewer-time-zone": "Mars/Olympus_Mons" })).toBeUndefined();
	});

	it("bounds the city to its column and keeps a malformed escape as raw text", () => {
		expect(readEdgeLocation({ "cf-ipcity": "x".repeat(300) })?.city).toHaveLength(128);
		expect(readEdgeLocation({ "cf-ipcity": "100%" })?.city).toBe("100%");
	});

	it("returns undefined when no CDN geo header is present", () => {
		expect(readEdgeLocation({ "user-agent": "curl/8.7.1" })).toBeUndefined();
	});
});
