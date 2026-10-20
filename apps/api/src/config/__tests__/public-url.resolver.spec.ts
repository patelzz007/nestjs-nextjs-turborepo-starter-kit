import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { PublicUrlResolver, resolveStoredPublicUrl } from "../public-url.resolver";

const FILE_PATH = "/api/v1/files/4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b/local-public";

describe("resolveStoredPublicUrl", () => {
	it("joins a path on this API to the API's current public address", () => {
		expect(resolveStoredPublicUrl(FILE_PATH, "http://192.168.1.23:8080")).toBe(`http://192.168.1.23:8080${FILE_PATH}`);
	});

	it("serves a CDN or bucket URL as it was stored", () => {
		expect(resolveStoredPublicUrl("https://cdn.example.com/stores/logo.webp", "http://192.168.1.23:8080")).toBe("https://cdn.example.com/stores/logo.webp");
	});

	it("keeps no URL as no URL", () => {
		expect(resolveStoredPublicUrl(null, "http://192.168.1.23:8080")).toBeNull();
	});
});

describe("PublicUrlResolver", () => {
	it("resolves against API_PUBLIC_URL", () => {
		const resolver = new PublicUrlResolver(createTestTypedConfig({ API_PUBLIC_URL: "https://api.example.com" }));

		expect(resolver.resolve(FILE_PATH)).toBe(`https://api.example.com${FILE_PATH}`);
	});
});
