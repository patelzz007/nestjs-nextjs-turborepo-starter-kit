"use client";

import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const RecentSearchSchema = z.object({
	title: z.string(),
	url: z.string(),
	section: z.string(),
	icon: z.string().optional(),
});

export type RecentSearch = z.output<typeof RecentSearchSchema>;

export interface WebCommandPaletteState {
	readonly recentSearches: readonly RecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly addRecentSearch: (item: RecentSearch) => void;
	readonly togglePinnedUrl: (url: string) => void;
}

const MAX_RECENT = 6;

const PersistedPaletteSchema = z.object({
	recentSearches: z.array(RecentSearchSchema).optional(),
	pinnedUrls: z.array(z.string()).optional(),
});

export const useWebCommandPaletteStore = create<WebCommandPaletteState>()(
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
			name: "web-command-palette-state",
			merge: (persistedState, currentState) => {
				const parsed = PersistedPaletteSchema.safeParse(persistedState);
				if (!parsed.success) {
					return currentState;
				}
				return { ...currentState, ...parsed.data };
			},
		},
	),
);
