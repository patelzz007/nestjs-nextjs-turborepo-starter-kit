"use client";

import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MerchantRecentSearchSchema = z.object({
	title: z.string(),
	url: z.string(),
	section: z.string(),
	icon: z.string().optional(),
});

export type MerchantRecentSearch = z.output<typeof MerchantRecentSearchSchema>;

export interface MerchantCommandPaletteState {
	readonly recentSearches: readonly MerchantRecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly addRecentSearch: (item: MerchantRecentSearch) => void;
	readonly togglePinnedUrl: (url: string) => void;
}

const MAX_RECENT = 6;

const PersistedPaletteSchema = z.object({
	recentSearches: z.array(MerchantRecentSearchSchema).optional(),
	pinnedUrls: z.array(z.string()).optional(),
});

export const useMerchantCommandPaletteStore = create<MerchantCommandPaletteState>()(
	persist(
		(set) => ({
			recentSearches: [],
			pinnedUrls: [],
			addRecentSearch: (item: MerchantRecentSearch): void => {
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
			name: "merchant-command-palette-state",
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
