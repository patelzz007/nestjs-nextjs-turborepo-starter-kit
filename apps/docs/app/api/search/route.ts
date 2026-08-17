import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import { initSimpleSearch } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

/**
 * Flattens a page's structured data (from the remark-structure plugin) into
 * the plain `content` string the search engine indexes.
 */
function pageContent(structuredData: StructuredData | (() => StructuredData) | undefined, fallback: string | undefined): string {
	if (typeof structuredData === "function" || structuredData === undefined) {
		return fallback ?? "";
	}
	return structuredData.contents
		.map((block) => block.content)
		.concat(fallback ?? "")
		.filter((block) => block.length > 0)
		.join("\n");
}

/**
 * The search database. Tags are fed into `keywords` so tag words still match
 * (searching "telescope" finds the Telescope guide) even though the chip
 * filter row was removed.
 */
const indexes: { title: string; description: string; content: string; url: string; keywords: string }[] = source.getPages().map((page) => ({
	title: page.data.title,
	description: page.data.description ?? "",
	content: pageContent(page.data.structuredData, page.data.description),
	url: page.url,
	keywords: (page.data.tags ?? []).join(" "),
}));

const server = initSimpleSearch({ indexes, search: { limit: 50 } });

export async function GET(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const query: string | null = url.searchParams.get("query");
	if (query === null || query.length === 0) {
		return Response.json([]);
	}

	return Response.json(await server.search(query, { limit: 50 }));
}
