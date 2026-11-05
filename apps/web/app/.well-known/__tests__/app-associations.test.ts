import type { PasskeyAppAssociations } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn<() => Promise<{ readonly data: PasskeyAppAssociations }>>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/web-server-api", () => ({
	createWebServerCaller: (): object => ({ auth: { passkeyAppAssociations: { query: mocks.query } } }),
}));

const { GET: assetLinks } = await import("../assetlinks.json/route");
const { GET: appleAppSiteAssociation } = await import("../apple-app-site-association/route");

const ASSOCIATIONS: PasskeyAppAssociations = {
	assetLinks: [
		{
			relation: ["delegate_permission/common.get_login_creds"],
			target: { namespace: "android_app", package_name: "com.example.starter", sha256_cert_fingerprints: ["AA:BB"] },
		},
	],
	appleAppSiteAssociation: { webcredentials: { apps: ["ABCDE12345.com.example.starter"] } },
};

beforeEach(() => {
	mocks.query.mockResolvedValue({ data: ASSOCIATIONS });
});

describe("the passkey app-association files (ADR 080)", () => {
	it("serves Android's asset links as the API states them, cacheable for an hour", async () => {
		const response = await assetLinks();

		expect(await response.json()).toStrictEqual(ASSOCIATIONS.assetLinks);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
	});

	it("serves Apple's app-site association as JSON", async () => {
		const response = await appleAppSiteAssociation();

		expect(await response.json()).toStrictEqual(ASSOCIATIONS.appleAppSiteAssociation);
		expect(response.headers.get("content-type")).toContain("application/json");
	});

	it("associates nothing when no app is configured", async () => {
		mocks.query.mockResolvedValue({ data: { assetLinks: [], appleAppSiteAssociation: { webcredentials: { apps: [] } } } });

		expect(await (await assetLinks()).json()).toStrictEqual([]);
		expect(await (await appleAppSiteAssociation()).json()).toStrictEqual({ webcredentials: { apps: [] } });
	});
});
