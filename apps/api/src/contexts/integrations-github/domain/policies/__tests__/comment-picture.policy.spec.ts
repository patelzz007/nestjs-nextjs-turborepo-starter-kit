import { describe, expect, it } from "vitest";

import { commentPicturePath, isOwnReadyCommentPicture, linkedPicturesIn } from "../comment-picture.policy";

const PULL_REQUEST = { owner: "octo-org", repository: "hello-world", number: 42 };
const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const PICTURE_URL = `https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/${FILE_ID}.png`;
const PICTURE_FILE = { owner: "octo-org", repository: "hello-world", ref: "github-comment-assets", path: `pull-requests/42/${FILE_ID}.png` };
const READY = { category: "GITHUB_COMMENT_IMAGE", uploadedById: "user-1", status: "READY" };

describe("linkedPicturesIn", () => {
	it("finds each picture attached from the app that a body links in this repository, once, as markdown or HTML", () => {
		const body = [`![shot](${PICTURE_URL})`, `<img src="${PICTURE_URL}" width="200" />`, `Again: ${PICTURE_URL}.`].join("\n");

		expect(linkedPicturesIn(body, PULL_REQUEST)).toEqual([{ number: 42, fileId: FILE_ID, extension: "png", file: PICTURE_FILE }]);
	});

	it("matches the repository without case, as GitHub does", () => {
		expect(linkedPicturesIn(`![shot](${PICTURE_URL})`, { owner: "Octo-Org", repository: "Hello-World" })).toHaveLength(1);
	});

	it("ignores other repositories, other branches, and files the app did not attach", () => {
		const body = [
			`![a](https://github.com/someone/else/raw/github-comment-assets/pull-requests/42/${FILE_ID}.png)`,
			`![b](https://github.com/octo-org/hello-world/raw/main/pull-requests/42/${FILE_ID}.png)`,
			"![c](https://github.com/octo-org/hello-world/raw/github-comment-assets/docs/logo.png)",
			"![d](https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/0/x.png)",
			"![e](https://example.com/picture.png)",
		].join("\n");

		expect(linkedPicturesIn(body, PULL_REQUEST)).toEqual([]);
	});

	it("finds nothing in an empty body", () => {
		expect(linkedPicturesIn("", PULL_REQUEST)).toEqual([]);
	});
});

describe("commentPicturePath", () => {
	it("keeps a picture under its pull request, named by its upload", () => {
		expect(commentPicturePath(42, FILE_ID, "png")).toBe(`pull-requests/42/${FILE_ID}.png`);
	});
});

describe("isOwnReadyCommentPicture", () => {
	it("accepts only the uploader's own ready comment picture", () => {
		expect(isOwnReadyCommentPicture(READY, "user-1")).toBe(true);
		expect(isOwnReadyCommentPicture(READY, "user-2")).toBe(false);
		expect(isOwnReadyCommentPicture({ ...READY, uploadedById: null }, "user-1")).toBe(false);
		expect(isOwnReadyCommentPicture({ ...READY, category: "USER_AVATAR" }, "user-1")).toBe(false);
		expect(isOwnReadyCommentPicture({ ...READY, status: "SCANNING" }, "user-1")).toBe(false);
	});
});
