import { GITHUB_BODY_IMAGES_MAX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AS_GITHUB_SERVES, isSignedUploadLink, signedUploadLinkIn, toBodyImages } from "../github-body-images";

const ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const SIGNED = `https://private-user-images.githubusercontent.com/31275601/674345813-${ID}.jpg?jwt=eyJ0&X-Amz-Expires=300`;
const NODE = "IC_kwDOAbCdEf5r1sT2";

describe("toBodyImages", () => {
	it("pairs an upload's signed link with the address the markdown names", () => {
		// What GitHub answers for `<img src="https://github.com/user-attachments/assets/…" />`, `&` escaped.
		const html = `<a target="_blank" href="${SIGNED.replace("&", "&amp;")}"><img width="735" alt="shot" src="${SIGNED.replace("&", "&amp;")}" style="max-width: 100%"></a>`;

		expect(toBodyImages(html, NODE, AS_GITHUB_SERVES)).toEqual([{ source: `https://github.com/user-attachments/assets/${ID}`, url: SIGNED }]);
	});

	it("pairs a proxied outside image with its original address", () => {
		const html = '<p><img src="https://camo.githubusercontent.com/5c7e/6874" alt="y" data-canonical-src="https://example.com/a.png?x=1&amp;y=2"></p>';

		expect(toBodyImages(html, NODE, AS_GITHUB_SERVES)).toEqual([{ source: "https://example.com/a.png?x=1&y=2", url: "https://camo.githubusercontent.com/5c7e/6874" }]);
	});

	it("lists an image served at its own address under that address", () => {
		expect(toBodyImages('<img src="https://avatars.githubusercontent.com/u/1?v=4" alt="z">', NODE, AS_GITHUB_SERVES)).toEqual([
			{ source: "https://avatars.githubusercontent.com/u/1?v=4", url: "https://avatars.githubusercontent.com/u/1?v=4" },
		]);
	});

	it("skips emoji, images without a web link, and repeats", () => {
		const html = [
			'<img class="emoji" title=":shipit:" alt=":shipit:" src="https://github.githubassets.com/images/icons/emoji/shipit.png">',
			'<img alt="no source">',
			'<img src="data:image/png;base64,AAAA">',
			'<img src="https://example.com/a.png">',
			'<img src="https://example.com/a.png">',
		].join("");

		expect(toBodyImages(html, NODE, AS_GITHUB_SERVES)).toEqual([{ source: "https://example.com/a.png", url: "https://example.com/a.png" }]);
	});

	it("loads each picture from where the caller's link says, for the node whose body shows it", () => {
		const html = '<img src="https://github.com/octo/repo/raw/github-comment-assets/pull-requests/1/a.png" alt="a">';

		expect(toBodyImages(html, NODE, (src: string, nodeId: string): string => `https://api.example.com/pictures/${nodeId}/${encodeURIComponent(src)}`)).toEqual([
			{
				source: "https://github.com/octo/repo/raw/github-comment-assets/pull-requests/1/a.png",
				url: `https://api.example.com/pictures/${NODE}/${encodeURIComponent("https://github.com/octo/repo/raw/github-comment-assets/pull-requests/1/a.png")}`,
			},
		]);
	});

	it("is empty for a body without images", () => {
		expect(toBodyImages('<p dir="auto">Looks good.</p>', NODE, AS_GITHUB_SERVES)).toEqual([]);
		expect(toBodyImages("", NODE, AS_GITHUB_SERVES)).toEqual([]);
	});

	it("lists at most the contract's limit", () => {
		const html = Array.from({ length: GITHUB_BODY_IMAGES_MAX + 5 }, (_, index: number): string => `<img src="https://example.com/${String(index)}.png">`).join("");

		expect(toBodyImages(html, NODE, AS_GITHUB_SERVES)).toHaveLength(GITHUB_BODY_IMAGES_MAX);
	});
});

describe("signedUploadLinkIn", () => {
	it("finds GitHub's current signed link to one upload, and nothing for an upload the body does not show", () => {
		const html = `<p><img src="https://camo.githubusercontent.com/5c7e/6874"><img src="${SIGNED.replace("&", "&amp;")}"></p>`;

		expect(signedUploadLinkIn(html, ID)).toBe(SIGNED);
		expect(signedUploadLinkIn(html, "00000000-0000-4000-8000-000000000000")).toBeNull();
	});

	it("takes only GitHub's signed-upload host — never an outside image that merely ends in the same id", () => {
		expect(signedUploadLinkIn(`<img src="https://example.com/${ID}.png">`, ID)).toBeNull();
		expect(isSignedUploadLink(SIGNED)).toBe(true);
		expect(isSignedUploadLink(`https://github.com/user-attachments/assets/${ID}`)).toBe(false);
		expect(isSignedUploadLink("not a link")).toBe(false);
	});
});
