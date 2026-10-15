import type { GithubBodyImage } from "@workspace/shared";

import { apiPicturePathOf } from "./use-github-picture-loader";

const UPLOAD = "https://api.example.com/api/v1/github/pictures/uploads/cb5fe4d3-85fb-4d1e-807a-1771925051be?node=IC_1";
const FILE = "https://api.example.com/api/v1/github/pictures/file?owner=o&repository=r&ref=github-comment-assets&path=a.png";
const IMAGES: readonly GithubBodyImage[] = [
	{ source: "https://github.com/user-attachments/assets/cb5fe4d3-85fb-4d1e-807a-1771925051be", url: UPLOAD },
	{ source: "https://github.com/o/r/raw/github-comment-assets/a.png", url: FILE },
	{ source: "https://example.com/b.png", url: "https://camo.githubusercontent.com/x" },
];

describe("apiPicturePathOf", () => {
	it("gives the API path (without its version) of a picture address the API listed", () => {
		expect(apiPicturePathOf(UPLOAD, IMAGES)).toBe("/github/pictures/uploads/cb5fe4d3-85fb-4d1e-807a-1771925051be?node=IC_1");
		expect(apiPicturePathOf(FILE, IMAGES)).toBe("/github/pictures/file?owner=o&repository=r&ref=github-comment-assets&path=a.png");
	});

	it("never takes an address the API did not list — a comment could name any address, and the session's token must not go with it", () => {
		expect(apiPicturePathOf("https://evil.example.com/api/v1/github/pictures/file?path=a.png", IMAGES)).toBeNull();
		expect(apiPicturePathOf("https://camo.githubusercontent.com/x", IMAGES)).toBeNull();
		expect(apiPicturePathOf("not an address", IMAGES)).toBeNull();
	});
});
