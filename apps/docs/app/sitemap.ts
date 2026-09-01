import type { MetadataRoute } from "next";

import { blogSource } from "@/lib/blog";
import { getGitLastModified } from "@/lib/page-meta";
import { BASE_URL } from "@/lib/site";
import { source } from "@/lib/source";

/** `/sitemap.xml` — the landing page, every guide and every blog post. */
export default function sitemap(): MetadataRoute.Sitemap {
	const guides: MetadataRoute.Sitemap = source.getPages().map((page) => {
		const gitModified: number | undefined = getGitLastModified(page.path);
		return {
			url: `${BASE_URL}${page.url}`,
			lastModified: gitModified !== undefined ? new Date(gitModified).toISOString() : undefined,
			changeFrequency: "weekly" as const,
			priority: 0.7,
		};
	});
	const posts: MetadataRoute.Sitemap = blogSource.getPages().map((page) => ({
		url: `${BASE_URL}${page.url}`,
		lastModified: new Date(page.data.date).toISOString(),
		changeFrequency: "weekly" as const,
		priority: 0.6,
	}));
	return [
		{ url: BASE_URL, changeFrequency: "daily", priority: 1 },
		{ url: `${BASE_URL}/docs`, changeFrequency: "daily", priority: 0.9 },
		{ url: `${BASE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
		...guides,
		...posts,
	];
}
