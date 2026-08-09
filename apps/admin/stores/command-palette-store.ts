"use client";

import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A page the user has navigated to from the command palette (for "Recent"). */
export interface CommandPaletteState {
	readonly recentSearches: readonly RecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly addRecentSearch: (item: RecentSearch) => void;
	readonly togglePinnedUrl: (url: string) => void;
}

const STORAGE_KEY = "command-palette-state";
const MAX_RECENT = 6;

/**
 * The persisted payload, as far as we'll trust it. Both fields are deliberate
 * user preferences (Recent + Pinned chips) and survive reloads on purpose.
 * The palette's *search text* is NOT here — it lives as local component state
 * in `command-palette.tsx` and resets on close/refresh.
 */
const RecentSearchSchema = z.object({
	title: z.string(),
	url: z.string(),
	section: z.string(),
	icon: z.string().optional(),
});

/** A page the user has navigated to from the command palette (for "Recent"). */
export type RecentSearch = z.infer<typeof RecentSearchSchema>;

const PersistedPaletteSchema = z.object({
	recentSearches: z.array(RecentSearchSchema).optional(),
	pinnedUrls: z.array(z.string()).optional(),
});

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
			// Validate before applying: a corrupted payload (e.g. `recentSearches`
			// stored as a string) would otherwise spread garbage into live state and
			// crash `addRecentSearch`. Falls back to the current state untouched —
			// same hardening pattern as the sidebar store. No `skipHydration` here:
			// the palette mounts only client-side (dynamic import, `ssr: false`), so
			// synchronous rehydration can't cause an SSR hydration mismatch.
			merge: (persistedState, currentState) => {
				const parsed = PersistedPaletteSchema.safeParse(persistedState);
				if (!parsed.success) {
					return currentState;
				}
				// Any field added to `CommandPaletteState` in the future must also be
				// added to `PersistedPaletteSchema` (or it's silently dropped here —
				// zod strips unknown keys by default).
				return {
					...currentState,
					...parsed.data,
				};
			},
		},
	),
);
