import type { Prisma } from "@prisma/client";
import { ImageSourceSchema, type ImageSource } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";

/**
 * A stored image's live, published renditions, smallest first — selected with
 * the file (no N+1) wherever a response serves the image (`srcset`).
 */
export const IMAGE_RENDITIONS_SELECT = {
	where: { isDeleted: false },
	orderBy: { width: "asc" },
	select: { width: true, publicPath: true },
} satisfies Prisma.StoredFile$variantsArgs;

/** The rows {@link IMAGE_RENDITIONS_SELECT} returns. */
export type ImageRenditionRows = readonly { readonly width: number | null; readonly publicPath: string | null }[];

/**
 * The renditions as `srcset` sources, smallest first, each stored reference
 * resolved to the URL a client opens (`resolve`). One without a width or a
 * public URL, or whose URL the contract would reject (not http(s)), is left
 * out — the image is still served from the others or from its own URL.
 */
export function toImageSources(renditions: ImageRenditionRows, resolve: PublicUrlResolve): ImageSource[] {
	return renditions.flatMap((rendition) => {
		const parsed = ImageSourceSchema.safeParse({ width: rendition.width, url: resolve(rendition.publicPath) });
		return parsed.success ? [parsed.data] : [];
	});
}
