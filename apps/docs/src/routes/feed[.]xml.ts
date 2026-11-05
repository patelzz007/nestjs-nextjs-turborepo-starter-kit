import { createFileRoute } from "@tanstack/react-router";

import { buildRssFeed } from "../lib/rss";
import { BLOG_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site";

/** RSS feed of the blog, newest first. */
export const Route = createFileRoute("/feed.xml")({
	server: {
		handlers: {
			GET: async (): Promise<Response> => {
				const { contentStore } = await import("../server/content.server");
				const posts = [...(await contentStore()).posts()].sort((left, right) => right.date - left.date);
				const xml = buildRssFeed({
					title: `${SITE_NAME} blog`,
					description: BLOG_DESCRIPTION,
					site: SITE_URL,
					items: posts.map((post) => ({
						title: post.title,
						description: post.description,
						link: post.href,
						pubDate: new Date(post.date),
						author: post.author,
						categories: [post.category],
					})),
				});
				return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
			},
		},
	},
});
