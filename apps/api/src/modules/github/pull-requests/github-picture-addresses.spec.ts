import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GithubPictureAddresses, repositoryFileAddress, repositoryFileOf } from "./github-picture-addresses";

const CONFIG = createTestTypedConfig({});
const API = `${CONFIG.http.publicUrl}${API_VERSION_PREFIX}`;
const NODE = "IC_kwDOAbCdEf5r1sT2";
const UPLOAD = "cb5fe4d3-85fb-4d1e-807a-1771925051be";

describe("repositoryFileOf", () => {
	it.each([
		["https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/a.png", "github-comment-assets", "pull-requests/42/a.png"],
		["https://github.com/octo-org/hello-world/blob/main/docs/My%20Logo.png", "main", "docs/My Logo.png"],
		["https://raw.githubusercontent.com/octo-org/hello-world/v1.0/logo.png", "v1.0", "logo.png"],
	])("reads %s", (address, ref, path) => {
		expect(repositoryFileOf(address)).toEqual({ owner: "octo-org", repository: "hello-world", ref, path });
	});

	it.each([
		"http://github.com/octo-org/hello-world/raw/main/a.png",
		"https://example.com/octo-org/hello-world/raw/main/a.png",
		"https://github.com/octo-org/hello-world/pull/42",
		"https://github.com/octo-org/hello-world/raw/main/../secrets.png",
		"https://github.com/octo-org/hello-world/raw/main/%E0%A4",
	])("names no file for %s", (address) => {
		expect(repositoryFileOf(address)).toBeNull();
	});

	it("round-trips the address a comment links a file by", () => {
		const file = { owner: "octo-org", repository: "hello-world", ref: "github-comment-assets", path: "pull-requests/42/My shot.png" };

		expect(repositoryFileOf(repositoryFileAddress(file))).toEqual(file);
	});
});

describe("GithubPictureAddresses.linkFor", () => {
	const addresses = new GithubPictureAddresses(CONFIG);

	it("lists a repository file at the API's own address — no reader, no expiry, so a cached answer stays good", () => {
		expect(addresses.linkFor("https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/a.png", NODE)).toBe(
			`${API}/github/pictures/file?owner=octo-org&repository=hello-world&ref=github-comment-assets&path=pull-requests%2F42%2Fa.png`,
		);
	});

	it("lists an upload to a private repository by its id and the body that shows it — never GitHub's expiring link", () => {
		expect(addresses.linkFor(`https://private-user-images.githubusercontent.com/1/2-${UPLOAD}.png?jwt=eyJ0`, NODE)).toBe(
			`${API}/github/pictures/uploads/${UPLOAD}?node=${NODE}`,
		);
	});

	it.each(["https://camo.githubusercontent.com/5c7e/6874", `https://github.com/user-attachments/assets/${UPLOAD}`, "https://avatars.githubusercontent.com/u/1?v=4"])(
		"leaves %s where GitHub serves it",
		(src) => {
			expect(addresses.linkFor(src, NODE)).toBe(src);
		},
	);
});
