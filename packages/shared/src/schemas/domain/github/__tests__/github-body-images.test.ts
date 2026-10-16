import { describe, expect, it } from "vitest";

import { GITHUB_BODY_IMAGES_MAX, GithubBodyImagesSchema, githubAttachmentIdOf, githubImageUrlFor, type GithubBodyImage } from "../github-body-images";

const ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const ATTACHMENT = `https://github.com/user-attachments/assets/${ID}`;
const SIGNED = `https://private-user-images.githubusercontent.com/31275601/674345813-${ID}.jpg?jwt=abc`;

describe("githubAttachmentIdOf", () => {
	it("reads the upload id from every address GitHub uses for an upload", () => {
		expect(githubAttachmentIdOf(ATTACHMENT)).toBe(ID);
		expect(githubAttachmentIdOf(SIGNED)).toBe(ID);
		expect(githubAttachmentIdOf(`https://github.com/octo/repo/assets/31275601/${ID}`)).toBe(ID);
		expect(githubAttachmentIdOf(`https://user-images.githubusercontent.com/1/2-${ID.toUpperCase()}.png`)).toBe(ID);
	});

	it("is null for any other image", () => {
		expect(githubAttachmentIdOf("https://example.com/a.png")).toBeNull();
		expect(githubAttachmentIdOf(`https://example.com/assets/${ID}`)).toBeNull();
		expect(githubAttachmentIdOf(`https://github.com/octo/repo/blob/main/${ID}`)).toBeNull();
		expect(githubAttachmentIdOf("https://github.com/user-attachments/assets/not-an-id")).toBeNull();
		expect(githubAttachmentIdOf("not a url")).toBeNull();
		expect(githubAttachmentIdOf(`javascript:alert("${ID}")`)).toBeNull();
	});
});

describe("githubImageUrlFor", () => {
	const proxied: GithubBodyImage = { source: "https://example.com/a.png", url: "https://camo.githubusercontent.com/abc/def" };
	const uploaded: GithubBodyImage = { source: ATTACHMENT, url: SIGNED };

	it("loads a listed image from its link", () => {
		expect(githubImageUrlFor("https://example.com/a.png", [proxied, uploaded])).toBe(proxied.url);
		expect(githubImageUrlFor(ATTACHMENT, [proxied, uploaded])).toBe(SIGNED);
	});

	it("matches an upload written under another of its addresses by its id", () => {
		expect(githubImageUrlFor(`https://github.com/octo/repo/assets/1/${ID}`, [uploaded])).toBe(SIGNED);
		expect(githubImageUrlFor(ATTACHMENT, [{ source: SIGNED, url: SIGNED }])).toBe(SIGNED);
	});

	it("falls back to the address itself when nothing is listed for it", () => {
		expect(githubImageUrlFor("https://example.com/b.png", [proxied])).toBe("https://example.com/b.png");
		expect(githubImageUrlFor(ATTACHMENT, [proxied])).toBe(ATTACHMENT);
	});
});

describe("GithubBodyImagesSchema", () => {
	it("accepts web links only", () => {
		expect(GithubBodyImagesSchema.safeParse([{ source: ATTACHMENT, url: SIGNED }]).success).toBe(true);
		expect(GithubBodyImagesSchema.safeParse([{ source: "file:///etc/passwd", url: SIGNED }]).success).toBe(false);
	});

	it("caps how many are listed", () => {
		const images = Array.from({ length: GITHUB_BODY_IMAGES_MAX + 1 }, (): GithubBodyImage => ({ source: ATTACHMENT, url: SIGNED }));
		expect(GithubBodyImagesSchema.safeParse(images).success).toBe(false);
	});
});
