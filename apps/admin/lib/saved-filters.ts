// ============================================
// lib/saved-filters.ts - Saved telescope filters (feature 9)
// ============================================
// Bookmarks a request-list filter (method / status / min duration / sort) so
// a common debugging view (e.g. "5xx on /auth/*") is one click away. Stored in
// localStorage under a namespaced key; every read/write goes through a zod
// schema so corrupt/legacy JSON can never break the requests page.
//
// This is the browser-side half of the feature — the API is untouched because
// the filter state already lives entirely in the URL/search-params of the
// requests page.

import { isServer } from "@workspace/client/lib/is-server";
import { z } from "zod";

const STORAGE_KEY = "telescope.savedFilters.v1";

/** The filter state worth bookmarking (everything the requests page sends). */
export const SavedFilterValueSchema = z
	.object({
		method: z.string(),
		status: z.string(),
		minDuration: z.string(),
		sort: z.string(),
	})
	.strict();

export type SavedFilterValue = z.output<typeof SavedFilterValueSchema>;

export const SavedFilterSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).max(60),
		filter: SavedFilterValueSchema,
		createdAt: z.number().int().nonnegative(),
	})
	.strict();

export type SavedFilter = z.output<typeof SavedFilterSchema>;

const STORED_LIST_SCHEMA = z.array(SavedFilterSchema);

/** Reads saved filters; invalid/corrupt data degrades to an empty list. */
export function loadSavedFilters(): readonly SavedFilter[] {
	if (isServer) {
		return [];
	}
	try {
		const raw: string | null = window.localStorage.getItem(STORAGE_KEY);
		if (raw === null) {
			return [];
		}
		const parsed = STORED_LIST_SCHEMA.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

/** Persists the whole list (callers pass the full list — single source of truth). */
export function persistSavedFilters(filters: readonly SavedFilter[]): void {
	if (isServer) {
		return;
	}
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

/** Adds a filter (dedupes by id), returns the new list. */
export function addSavedFilter(filter: SavedFilter): readonly SavedFilter[] {
	const next: readonly SavedFilter[] = [filter, ...loadSavedFilters().filter((existing: SavedFilter): boolean => existing.id !== filter.id)];
	persistSavedFilters(next);
	return next;
}

/** Removes a filter by id, returns the new list. */
export function removeSavedFilter(id: string): readonly SavedFilter[] {
	const next: readonly SavedFilter[] = loadSavedFilters().filter((existing: SavedFilter): boolean => existing.id !== id);
	persistSavedFilters(next);
	return next;
}
