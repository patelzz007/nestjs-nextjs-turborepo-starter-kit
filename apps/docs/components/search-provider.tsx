"use client";

import { SearchProvider, type SearchProviderProps } from "fumadocs-ui/contexts/search";
import type { ReactNode } from "react";

import { SearchMetaContext } from "@/components/search-meta-context";
import { DocsSearchDialog } from "@/components/search-dialog";
import type { SearchMetaEntry } from "@/lib/search-meta";

/**
 * SearchProvider wired to the custom `DocsSearchDialog` (description-rich
 * results) and the local search API (`/api/search`). The description map is
 * computed server-side (from frontmatter) and passed in as a prop — the client
 * never touches the page index and nothing fetches during static generation.
 */
export function DocsSearchProvider({ children, meta = {} }: { readonly children: ReactNode; meta?: Readonly<Record<string, SearchMetaEntry>> }): React.JSX.Element {
	const props: SearchProviderProps = {
		SearchDialog: DocsSearchDialog,
		options: { api: "/api/search" },
		links: [["Guides", "/docs"]],
		children,
	};
	return (
		<SearchMetaContext.Provider value={meta}>
			<SearchProvider {...props} />
		</SearchMetaContext.Provider>
	);
}
