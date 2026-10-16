import { COVER_IMAGE_DEFAULT_RATIO } from "@workspace/ui/components/cover-image";
import type { Code, Html, Root } from "mdast";
import { visit } from "unist-util-visit";

import { DocsCarouselPropsSchema, DocsImageResizerPropsSchema, type DocsImage, type MediaIslandPayload } from "../media/props";
import { renderMediaIsland } from "../media/render";
import { parseFenceAttribute } from "./fence-meta";
import { rewriteImageUrl } from "./remark-plugins";

/**
 * ```` ```carousel ```` and ```` ```image-resize ```` fences become the apps' own components
 * from `@workspace/ui` — `ImageCarousel` and `ImageResizer` — rendered at build time and hydrated
 * in the browser (`src/scripts/media-islands.ts`), like the code blocks. The fence body lists the
 * images, one `![alt](url)` per line (repo-relative `images/…` paths work as in prose).
 *
 * ````md
 * ```carousel ratio="16/9"
 * ![The welcome email](images/email/welcome.png)
 * ![The verification email](images/email/verification.png)
 * ```
 *
 * ```image-resize width="480" height="360"
 * ![The welcome email](images/email/welcome.png)
 * ```
 * ````
 *
 * A carousel's `ratio` (width/height, or one number) shapes every slide (default 16/9). A resizable
 * image starts at `width` × `height` CSS pixels and keeps that shape while resized, unless
 * `aspect="free"`. A malformed fence fails the build.
 */

/** The fence languages that mark a media island. */
export const CAROUSEL_FENCE_LANGUAGE = "carousel";
export const IMAGE_RESIZE_FENCE_LANGUAGE = "image-resize";

/** The `aspect` value that lets a resizable image's sides change independently. */
export const FREE_ASPECT = "free";

/** A media fence the build cannot turn into its component. */
export class MediaEmbedSyntaxError extends Error {
	public constructor(fence: string, message: string) {
		super(`\`\`\`${fence} fence: ${message}`);
		this.name = "MediaEmbedSyntaxError";
	}
}

const IMAGE_LINE_PATTERN = /^!\[(?<alt>[^\]]*)\]\((?<url>[^)\s]+)\)$/;
const RATIO_PATTERN = /^(?<width>\d+(?:\.\d+)?)(?:\/(?<height>\d+(?:\.\d+)?))?$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

/** The images a fence body lists, one `![alt](url)` per non-blank line. */
export function parseFenceImages(fence: string, body: string): DocsImage[] {
	const images: DocsImage[] = [];
	for (const [lineIndex, rawLine] of body.split("\n").entries()) {
		const line = rawLine.trim();
		if (line.length === 0) {
			continue;
		}
		const match = IMAGE_LINE_PATTERN.exec(line);
		const url = match?.groups?.url;
		if (url === undefined) {
			throw new MediaEmbedSyntaxError(fence, `line ${String(lineIndex + 1)} is not an image (\`![alt](url)\`): ${line}`);
		}
		images.push({ src: rewriteImageUrl(url), alt: match?.groups?.alt ?? "" });
	}
	return images;
}

/** `16/9` or `1.5` → the width ÷ height it names. */
export function parseRatio(fence: string, text: string): number {
	const match = RATIO_PATTERN.exec(text.trim());
	const width = Number(match?.groups?.width);
	const height = Number(match?.groups?.height ?? "1");
	if (match === null || !(width > 0) || !(height > 0)) {
		throw new MediaEmbedSyntaxError(fence, `ratio="${text}" is not a width/height ratio (e.g. "16/9")`);
	}
	return width / height;
}

function parseSide(fence: string, name: string, meta: string): number {
	const text = parseFenceAttribute(meta, name);
	if (text === null || !WHOLE_NUMBER_PATTERN.test(text)) {
		throw new MediaEmbedSyntaxError(fence, `${name}="…" (whole CSS pixels) is required`);
	}
	return Number(text);
}

/** A ```` ```carousel ```` fence's island. */
export function carouselPayload(body: string, meta: string): MediaIslandPayload {
	const ratio = parseFenceAttribute(meta, "ratio");
	const props = DocsCarouselPropsSchema.parse({
		images: parseFenceImages(CAROUSEL_FENCE_LANGUAGE, body),
		ratio: ratio === null ? COVER_IMAGE_DEFAULT_RATIO : parseRatio(CAROUSEL_FENCE_LANGUAGE, ratio),
	});
	return { kind: "carousel", props };
}

/** An ```` ```image-resize ```` fence's island. */
export function imageResizePayload(body: string, meta: string): MediaIslandPayload {
	const [image, ...extra] = parseFenceImages(IMAGE_RESIZE_FENCE_LANGUAGE, body);
	if (image === undefined || extra.length > 0) {
		throw new MediaEmbedSyntaxError(IMAGE_RESIZE_FENCE_LANGUAGE, "takes exactly one image");
	}
	const width = parseSide(IMAGE_RESIZE_FENCE_LANGUAGE, "width", meta);
	const height = parseSide(IMAGE_RESIZE_FENCE_LANGUAGE, "height", meta);
	const props = DocsImageResizerPropsSchema.parse({
		image,
		width,
		height,
		aspectRatio: parseFenceAttribute(meta, "aspect") === FREE_ASPECT ? null : width / height,
	});
	return { kind: "image-resize", props };
}

/** Replaces every media fence with its island (before `rehypeCodeBlock`, so it is never highlighted as code). */
export function remarkMediaEmbeds(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "code", (node: Code, index, parent) => {
			if (parent === undefined || index === undefined) {
				return;
			}
			const meta = node.meta ?? "";
			let payload: MediaIslandPayload;
			if (node.lang === CAROUSEL_FENCE_LANGUAGE) {
				payload = carouselPayload(node.value, meta);
			} else if (node.lang === IMAGE_RESIZE_FENCE_LANGUAGE) {
				payload = imageResizePayload(node.value, meta);
			} else {
				return;
			}
			const html: Html = { type: "html", value: renderMediaIsland(payload) };
			parent.children.splice(index, 1, html);
		});
	};
}
