import { z } from "zod";

/** Repo-root `blog/meta.json`: the curated post order (newest first when absent). */
export const BlogMetaSchema = z
	.object({
		title: z.string().optional(),
		pages: z.array(z.string().min(1)),
	})
	.strict();

export type BlogMeta = z.output<typeof BlogMetaSchema>;

export interface PostSummary {
	readonly id: string;
	readonly date: number;
}

/** Posts in `meta.json` order first, then any unlisted posts newest first. */
export function orderPosts<TPost extends PostSummary>(meta: BlogMeta, posts: readonly TPost[]): readonly TPost[] {
	const rank = new Map(meta.pages.map((id, index) => [id, index]));
	return [...posts].sort((a, b) => {
		const rankA = rank.get(a.id);
		const rankB = rank.get(b.id);
		if (rankA !== undefined && rankB !== undefined) {
			return rankA - rankB;
		}
		if (rankA !== undefined) {
			return -1;
		}
		if (rankB !== undefined) {
			return 1;
		}
		return b.date - a.date;
	});
}

/** Public URL of a blog post. */
export function postHref(id: string): string {
	return `/blog/${id}`;
}
