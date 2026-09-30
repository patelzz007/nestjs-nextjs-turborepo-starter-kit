import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { postHref } from "@/lib/blog";
import { getPosts } from "@/lib/content";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** RSS feed of the blog, newest first. */
export const GET: APIRoute = async ({ site }) => {
	const posts = [...(await getPosts())].sort((a, b) => b.data.date - a.data.date);
	return rss({
		title: `${SITE_NAME} blog`,
		description: "Engineering notes on how and why the monorepo is built the way it is.",
		site: site ?? SITE_URL,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			link: postHref(post.id),
			pubDate: new Date(post.data.date),
			author: post.data.author,
			categories: [post.data.category],
		})),
	});
};
