// ============================================
// github-body-images.ts - The image links in GitHub's rendering of a body
// ============================================
// GitHub renders every comment itself (`bodyHTML`), and that rendering is the
// only place a working link for an image uploaded to a private repository can
// be found: a signed `private-user-images…` link that expires within minutes —
// so it is read afresh each time the picture is opened, never handed out. Outside images
// are rewritten to GitHub's image proxy, with the original kept in
// `data-canonical-src`. This reads the `<img>` tags of that HTML — GitHub's own,
// sanitized output — and pairs each link with the address the markdown names.
// Emoji are drawn as text by the app and are skipped.

import { GITHUB_BODY_IMAGES_MAX, GithubBodyImageSchema, githubAttachmentIdOf, type GithubBodyImage } from "@workspace/shared";
import { z } from "zod";

const IMAGE_TAG_PATTERN = /<img\b(?<attributes>[^>]*)>/giu;
/** GitHub writes every attribute double-quoted. */
const ATTRIBUTE_PATTERN = /(?<name>[\w-]+)="(?<value>[^"]*)"/gu;
const ENTITY_PATTERN = /&(?<entity>amp|quot|lt|gt|#39|#x27);/gu;

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", quot: '"', lt: "<", gt: ">", "#39": "'", "#x27": "'" };

/** Where GitHub's markdown names an upload — so a signed link can be paired with it. */
const ATTACHMENT_ADDRESS_PREFIX = "https://github.com/user-attachments/assets/";

function decodeEntities(value: string): string {
	return value.replace(ENTITY_PATTERN, (match: string, entity: string): string => ENTITIES[entity] ?? match);
}

function attributesOf(tag: string): ReadonlyMap<string, string> {
	const attributes = new Map<string, string>();
	for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
		const name = match.groups?.name;
		const value = match.groups?.value;
		if (name !== undefined && value !== undefined) {
			attributes.set(name.toLowerCase(), decodeEntities(value));
		}
	}
	return attributes;
}

/** The address the markdown names for an image GitHub serves at `src`. */
function sourceOf(src: string, canonicalSource: string | undefined): string {
	if (canonicalSource !== undefined) {
		return canonicalSource;
	}
	const attachmentId = githubAttachmentIdOf(src);
	return attachmentId === null ? src : `${ATTACHMENT_ADDRESS_PREFIX}${attachmentId}`;
}

/**
 * Where the app loads a picture GitHub serves at `src`, in the body of node
 * `nodeId`. A picture GitHub shows only to a signed-in reader — a repository
 * file, or an upload to a private repository (whose signed link expires in
 * minutes) — gets an address of the API's own (`GithubPictureAddresses`);
 * every other address is loaded as it is.
 */
export type BodyImageLink = (src: string, nodeId: string) => string;

/** Loads every picture from where GitHub serves it — for bodies whose pictures need no address of ours. */
export const AS_GITHUB_SERVES: BodyImageLink = (src: string): string => src;

/** The host of GitHub's signed links to uploads in private repositories. */
export const GITHUB_SIGNED_UPLOAD_HOST = "private-user-images.githubusercontent.com";

/** The image sources of a rendered body, in order — emoji excepted. */
function imageSourcesOf(bodyHtml: string): { readonly src: string; readonly canonicalSource: string | undefined }[] {
	const sources: { readonly src: string; readonly canonicalSource: string | undefined }[] = [];
	for (const match of bodyHtml.matchAll(IMAGE_TAG_PATTERN)) {
		const attributes = attributesOf(match.groups?.attributes ?? "");
		const src = attributes.get("src");
		const isEmoji = (attributes.get("class") ?? "").split(/\s+/u).includes("emoji");
		if (src !== undefined && !isEmoji) {
			sources.push({ src, canonicalSource: attributes.get("data-canonical-src") });
		}
	}
	return sources;
}

/** Whether `src` is GitHub's signed link to an upload in a private repository. */
export function isSignedUploadLink(src: string): boolean {
	const url = z.url({ protocol: /^https$/u }).safeParse(src);
	return url.success && new URL(url.data).hostname === GITHUB_SIGNED_UPLOAD_HOST && githubAttachmentIdOf(url.data) !== null;
}

/** GitHub's current signed link to upload `attachmentId` in a rendered body, or `null` when the body has none. */
export function signedUploadLinkIn(bodyHtml: string, attachmentId: string): string | null {
	const found = imageSourcesOf(bodyHtml).find(({ src }): boolean => isSignedUploadLink(src) && githubAttachmentIdOf(src) === attachmentId);
	return found?.src ?? null;
}

/** Each image of node `nodeId`'s rendered body, once, in order — at most {@link GITHUB_BODY_IMAGES_MAX}. */
export function toBodyImages(bodyHtml: string, nodeId: string, linkFor: BodyImageLink): GithubBodyImage[] {
	const images = new Map<string, GithubBodyImage>();
	for (const { src, canonicalSource } of imageSourcesOf(bodyHtml)) {
		const image = GithubBodyImageSchema.safeParse({ source: sourceOf(src, canonicalSource), url: linkFor(src, nodeId) });
		if (image.success && !images.has(image.data.source)) {
			images.set(image.data.source, image.data);
		}
		if (images.size === GITHUB_BODY_IMAGES_MAX) {
			break;
		}
	}
	return [...images.values()];
}
