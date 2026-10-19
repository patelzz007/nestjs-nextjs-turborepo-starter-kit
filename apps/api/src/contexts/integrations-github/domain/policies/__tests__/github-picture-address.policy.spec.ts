import { describe, expect, it } from "vitest";

import { repositoryFileAddress, repositoryFileOf } from "../github-picture-address.policy";

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
