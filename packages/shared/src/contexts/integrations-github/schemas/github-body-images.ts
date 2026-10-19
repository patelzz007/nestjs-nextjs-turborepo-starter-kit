// ============================================
// github-body-images.ts - Where the images of a GitHub comment can be loaded (ADR 052)
// ============================================
// A comment's markdown names its images as the author wrote them. An image
// uploaded to a private repository (`https://github.com/user-attachments/assets/<id>`)
// or kept in one (`github.com/<owner>/<repo>/raw/…`) is shown by GitHub only to
// a signed-in reader, and outside images go through its image proxy. The API
// sends, beside the markdown, where the app loads each image: the API's own
// address for the first two (`/github/pictures/…`: it names no reader and never
// expires — the app opens it signed in, and the API reads the picture with that
// reader's token), the proxy's for the rest. A client draws each image from the
// address that matches it.

import { z } from "zod";

/** Most images listed for one body; GitHub's own body limit keeps real comments far below it. */
export const GITHUB_BODY_IMAGES_MAX = 100;

const WebUrlSchema = z.url({ protocol: /^https?$/ });

/** One image of a body: its address as written in the markdown, and where to load it now. */
export const GithubBodyImageSchema = z.object({
	/** The address the markdown (or its `<img>`) names. */
	source: WebUrlSchema,
	/** Where to load it: the API's own address for a picture GitHub shows only to signed-in readers, GitHub's image proxy for an outside image. */
	url: WebUrlSchema,
});

export type GithubBodyImage = z.output<typeof GithubBodyImageSchema>;

export const GithubBodyImagesSchema = z.array(GithubBodyImageSchema).max(GITHUB_BODY_IMAGES_MAX);

/** Hosts GitHub serves uploaded images from: `github.com/…/assets/…` and the two image domains. */
const GITHUB_ATTACHMENT_HOSTS: readonly string[] = ["github.com", "private-user-images.githubusercontent.com", "user-images.githubusercontent.com"];

/** The upload's id ends the path: `/assets/<id>`, or `<number>-<id>.<extension>` on the image domains. */
const ATTACHMENT_ID_PATTERN = /(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.[a-z0-9]+)?$/iu;

/**
 * The id of an image uploaded to GitHub, from any of the addresses GitHub
 * uses for it (`null` for any other image). The same upload has the same id
 * in the markdown and in its signed link, which is how the two are matched.
 */
export function githubAttachmentIdOf(address: string): string | null {
	const parsed = WebUrlSchema.safeParse(address);
	if (!parsed.success) {
		return null;
	}
	const url = new URL(parsed.data);
	if (!GITHUB_ATTACHMENT_HOSTS.includes(url.hostname)) {
		return null;
	}
	if (url.hostname === "github.com" && !url.pathname.includes("/assets/")) {
		return null;
	}
	const id = ATTACHMENT_ID_PATTERN.exec(url.pathname)?.groups?.id;
	return id === undefined ? null : id.toLowerCase();
}

/**
 * Where to load an image a body names: its listed link (matched by address,
 * or by upload id), or the address itself when nothing is listed for it.
 */
export function githubImageUrlFor(source: string, images: readonly GithubBodyImage[]): string {
	const exact = images.find((image: GithubBodyImage): boolean => image.source === source);
	if (exact !== undefined) {
		return exact.url;
	}
	const attachmentId = githubAttachmentIdOf(source);
	if (attachmentId === null) {
		return source;
	}
	const sameUpload = images.find((image: GithubBodyImage): boolean => githubAttachmentIdOf(image.source) === attachmentId || githubAttachmentIdOf(image.url) === attachmentId);
	return sameUpload?.url ?? source;
}
