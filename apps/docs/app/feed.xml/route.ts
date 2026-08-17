import { getGitLastModified } from "@/lib/page-meta";
import { BASE_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { source } from "@/lib/source";

/** Escapes XML text content (attribute-safe subset covers titles/descriptions). */
function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * `/feed.xml` — a plain RSS 2.0 channel of every guide, so the docs are
 * subscribable (changelog-style). Dates come from git history when available,
 * falling back to the frontmatter `lastUpdated`.
 */
export function GET(): Response {
	const items: string = source
		.getPages()
		.map((page) => {
			const gitModified: number | undefined = getGitLastModified(page.path);
			const pubDate: string = new Date(gitModified ?? page.data.lastUpdated).toUTCString();
			const description: string = page.data.description ?? "";
			return [
				"<item>",
				`<title>${escapeXml(page.data.title)}</title>`,
				`<link>${BASE_URL}${page.url}</link>`,
				`<guid isPermaLink="true">${BASE_URL}${page.url}</guid>`,
				`<pubDate>${pubDate}</pubDate>`,
				`<description>${escapeXml(description)}</description>`,
				"</item>",
			].join("");
		})
		.join("\n");

	const xml: string = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
		"<channel>",
		`<title>${escapeXml(SITE_NAME)}</title>`,
		`<link>${BASE_URL}</link>`,
		`<description>${escapeXml(SITE_DESCRIPTION)}</description>`,
		`<atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
		items,
		"</channel>",
		"</rss>",
	].join("\n");

	return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
