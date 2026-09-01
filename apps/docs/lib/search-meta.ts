import { source } from "@/lib/source";

/**
 * Server-side search metadata: description per page URL. Consumed by the
 * custom search dialog (via the search-meta context) to show a snippet under
 * each result row.
 */
export interface SearchMetaEntry {
	readonly description: string;
}

export function buildSearchMeta(): Readonly<Record<string, SearchMetaEntry>> {
	const meta: Record<string, SearchMetaEntry> = {};
	for (const page of source.getPages()) {
		meta[page.url] = {
			description: page.data.description ?? "",
		};
	}
	return meta;
}
