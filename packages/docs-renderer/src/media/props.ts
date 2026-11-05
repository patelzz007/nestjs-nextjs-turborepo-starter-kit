import { DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX } from "@workspace/shared";
import { z } from "zod";

/**
 * Props for the docs' media islands — a ```` ```carousel ```` fence's `ImageCarousel` and an
 * ```` ```image-resize ```` fence's `ImageResizer` (both from `@workspace/ui`) — serialised into
 * the page at build time and parsed back in the browser, so what the build rendered is exactly
 * what React hydrates.
 */

/** The fewest images a carousel takes: one image needs no carousel. */
export const MIN_CAROUSEL_IMAGES = 2;
/** The most images one carousel takes: a gallery, not a photo dump. */
export const MAX_CAROUSEL_IMAGES = 12;
/** The longest alt text: a sentence or two, not a caption essay. */
export const MAX_IMAGE_ALT_LENGTH = 300;
/** The largest side of a resizable image, in CSS pixels — wider than any docs column. */
export const MAX_RESIZABLE_IMAGE_SIDE_PX = 2000;
/** The longest image URL. */
export const MAX_IMAGE_URL_LENGTH = 2048;

/** A site path (`/images/a.png`, never protocol-relative `//host`) or an absolute https URL. */
export const DocsImageUrlSchema = z.union([
	z
		.string()
		.max(MAX_IMAGE_URL_LENGTH)
		.regex(/^\/(?!\/)\S*$/),
	z.url({ protocol: /^https$/ }).max(MAX_IMAGE_URL_LENGTH),
]);

export const DocsImageSchema = z
	.object({
		src: DocsImageUrlSchema,
		alt: z.string().max(MAX_IMAGE_ALT_LENGTH),
	})
	.strict();

export type DocsImage = z.output<typeof DocsImageSchema>;

/** A side no smaller than the resizer allows (so the starting size is never clamped) and no larger than any column. */
const ImageSideSchema = z.number().int().min(DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX).max(MAX_RESIZABLE_IMAGE_SIDE_PX);

export const DocsCarouselPropsSchema = z
	.object({
		images: z.array(DocsImageSchema).min(MIN_CAROUSEL_IMAGES).max(MAX_CAROUSEL_IMAGES),
		/** Width ÷ height of every slide. */
		ratio: z.number().positive(),
	})
	.strict();

export type DocsCarouselProps = z.output<typeof DocsCarouselPropsSchema>;

export const DocsImageResizerPropsSchema = z
	.object({
		image: DocsImageSchema,
		/** The size the image starts at, in CSS pixels. */
		width: ImageSideSchema,
		height: ImageSideSchema,
		/** Keep width ÷ height while resizing; `null` lets the sides change independently. */
		aspectRatio: z.number().positive().nullable(),
	})
	.strict();

export type DocsImageResizerProps = z.output<typeof DocsImageResizerPropsSchema>;

export const MediaIslandKindSchema = z.enum(["carousel", "image-resize"]);

export type MediaIslandKind = z.output<typeof MediaIslandKindSchema>;

/** One island's props, tagged with the component it hydrates into. */
export const MediaIslandPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("carousel"), props: DocsCarouselPropsSchema }).strict(),
	z.object({ kind: z.literal("image-resize"), props: DocsImageResizerPropsSchema }).strict(),
]);

export type MediaIslandPayload = z.output<typeof MediaIslandPayloadSchema>;

/** JSON for an inline `<script type="application/json">`: `<` is escaped so the payload can never close the tag. */
export function serializeMediaIslandPayload(payload: MediaIslandPayload): string {
	return JSON.stringify(payload).replace(/</g, "\\u003c");
}

/** Parses a serialised payload (throws on anything the build did not produce). */
export function parseMediaIslandPayload(json: string): MediaIslandPayload {
	return MediaIslandPayloadSchema.parse(JSON.parse(json));
}
