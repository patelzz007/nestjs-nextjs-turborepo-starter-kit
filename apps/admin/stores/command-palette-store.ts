"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A page the user has navigated to from the command palette (for "Recent"). */
export interface RecentSearch {
	readonly title: string;
	readonly url: string;
	readonly section: string;
	readonly icon?: string;
}

export interface CommandPaletteState {
	readonly recentSearches: readonly RecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly addRecentSearch: (item: RecentSearch) => void;
	readonly togglePinnedUrl: (url: string) => void;
}

const STORAGE_KEY = "command-palette-state";
const MAX_RECENT = 6;

/**
 * Command palette UI state — which pages were recently opened and which are
 * pinned. Persisted to `localStorage` (key `command-palette-state`) so the
 * user's shortcuts survive reloads. Actions use block bodies with explicit
 * `(): void` return types because `persist` types `set` as returning
 * `unknown` (expression bodies would fail the void check).
 */
export const useCommandPaletteStore = create<CommandPaletteState>()(
	persist(
		(set) => ({
			recentSearches: [],
			pinnedUrls: [],
			addRecentSearch: (item: RecentSearch): void => {
				set((state) => ({
					recentSearches: [item, ...state.recentSearches.filter((entry) => entry.url !== item.url)].slice(0, MAX_RECENT),
				}));
			},
			togglePinnedUrl: (url: string): void => {
				set((state) => ({
					pinnedUrls: state.pinnedUrls.includes(url) ? state.pinnedUrls.filter((entry) => entry !== url) : [url, ...state.pinnedUrls],
				}));
			},
		}),
		{
			name: STORAGE_KEY,
		},
	),
);
