import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

/**
 * The blog articles live in the repo-root `blog/` folder (same pattern as the
 * guides in `docs/` — one source of truth, no mirrored copies). `dir`
 * resolves relative to this file's directory (`apps/docs/lib/`), so
 * `../../blog` is the repository root `blog/`.
 *
 * Frontmatter extends fumadocs's `pageSchema` with the fields every post
 * carries: `author`, `date` (epoch-ms, per the repo-wide convention) and
 * `category` (the chip shown on cards and the article header). All three are
 * REQUIRED so a half-baked post fails the build instead of shipping with a
 * blank meta row.
 */
const blog = defineDocs({
	dir: "../../blog",
	docs: {
		schema: pageSchema.extend({
			author: z.string(),
			/** Epoch-ms integer — display always via date-fns. */
			date: z.number().int(),
			/** Display category — drives the card chip and header label. */
			category: z.string(),
		}),
	},
});

export const blogSource = loader({
	baseUrl: "/blog",
	source: blog.toFumadocsSource(),
});

/** All published posts, newest first (listing order for `/blog`). */
export function getBlogPosts(): ReturnType<typeof blogSource.getPages> {
	return [...blogSource.getPages()].sort((a, b) => b.data.date - a.data.date);
}
