import { describe, expect, it } from "vitest";

import { mapOrganizationLogo } from "./organization-logo.util";
import { TEST_RESOLVE_PUBLIC_URL } from "../../../../test/support/public-urls";

const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

describe("mapOrganizationLogo", () => {
	it("returns the live logo's file, public URL and renditions", () => {
		expect(
			mapOrganizationLogo(
				[
					{
						fileId: FILE_ID,
						file: { publicPath: "https://cdn.example.com/stores/logo.webp", variants: [{ width: 128, publicPath: "https://cdn.example.com/stores/thumbnail/logo.webp" }] },
					},
				],
				TEST_RESOLVE_PUBLIC_URL,
			),
		).toEqual({
			fileId: FILE_ID,
			url: "https://cdn.example.com/stores/logo.webp",
			sources: [{ width: 128, url: "https://cdn.example.com/stores/thumbnail/logo.webp" }],
		});
	});

	it("is null without a logo, or when the logo has no public URL", () => {
		expect(mapOrganizationLogo([], TEST_RESOLVE_PUBLIC_URL)).toBeNull();
		expect(mapOrganizationLogo([{ fileId: FILE_ID, file: { publicPath: null, variants: [] } }], TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});

	it("degrades a stored URL the contract would reject to no logo, instead of failing the response", () => {
		expect(mapOrganizationLogo([{ fileId: FILE_ID, file: { publicPath: "javascript:alert(1)", variants: [] } }], TEST_RESOLVE_PUBLIC_URL)).toBeNull();
		expect(mapOrganizationLogo([{ fileId: "not-a-uuid", file: { publicPath: "https://cdn.example.com/logo.webp", variants: [] } }], TEST_RESOLVE_PUBLIC_URL)).toBeNull();
	});
});
