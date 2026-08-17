"use client";

import { createContext, useContext } from "react";

import type { SearchMetaEntry } from "@/lib/search-meta";

/**
 * Carries the `{ url → { description, tags } }` map from the server layout into
 * the (client) search dialog. The map is computed once at build time — no
 * client-side fetch, no suspended render during SSG.
 */
export const SearchMetaContext = createContext<Readonly<Record<string, SearchMetaEntry>>>({});

export function useSearchMeta(): Readonly<Record<string, SearchMetaEntry>> {
	return useContext(SearchMetaContext);
}
