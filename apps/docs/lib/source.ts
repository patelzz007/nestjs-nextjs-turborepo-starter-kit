import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

/**
 * The guides live in the repo-root `docs/` folder (the single source of
 * truth — no mirrored copies). `dir` resolves relative to this config file's
 * directory (`apps/docs/`), so `../../docs` is the repository root `docs/`.
 * The frontmatter schema extends fumadocs's `pageSchema` with the fields the
 * guides carry — `order` (kept for reference; the sidebar order is pinned in
 * `docs/meta.json`), `author`, `lastUpdated` (epoch-ms, per the repo-wide
 * convention), `coverImage` (banner art) and `tags` (search taxonomy).
 *
 * `author`, `lastUpdated` and `coverImage` are REQUIRED: the build fails fast
 * on a half-baked page instead of shipping a banner-less, undated doc (the
 * footer/banner/OG images all read these). `tags` feed the search keywords
 * index and the search dialog's filter chips.
 */
const docs = defineDocs({
	dir: "../../docs",
	docs: {
		schema: pageSchema.extend({
			order: z.number().int().min(1).optional(),
			author: z.string(),
			/** Epoch-ms integer — display always via date-fns. */
			lastUpdated: z.number().int(),
			/** Absolute https image URL used as the banner cover art. */
			coverImage: z.string(),
			/** Search/taxonomy tags — drive the search dialog's filter chips. */
			tags: z.array(z.string()).optional(),
		}),
	},
});

export const source = loader({
	baseUrl: "/docs",
	source: docs.toFumadocsSource(),
});
