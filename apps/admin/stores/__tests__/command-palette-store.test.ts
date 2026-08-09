// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { z } from "zod";

import { useCommandPaletteStore, type RecentSearch } from "@/stores/command-palette-store";

const RECENT: RecentSearch = { title: "Settings", url: "/settings/general", section: "Settings", icon: "Settings" };

/** Shape of what zustand persist writes to localStorage for the palette store. */
const StoredPalettePayloadSchema = z.object({
	state: z.object({
		recentSearches: z.array(z.object({ title: z.string(), url: z.string(), section: z.string(), icon: z.string().optional() })).optional(),
		pinnedUrls: z.array(z.string()).optional(),
		// Search text must NEVER appear — the palette query is local component
		// state, not part of the persisted store.
		searchText: z.string().optional(),
		searchQuery: z.string().optional(),
	}),
});

describe("CommandPaletteStore persistence", () => {
	beforeEach(() => {
		localStorage.clear();
		useCommandPaletteStore.setState({ recentSearches: [], pinnedUrls: [] });
	});

	it("persists recents and pins across a simulated reload (deliberate preference)", async () => {
		// Simulate a reload WITHOUT zustand's auto-write getting in the way:
		// reset the in-memory state to defaults first, then seed localStorage
		// directly (exactly what a previous session would have left behind),
		// then rehydrate. If rehydrate/merge silently did nothing, the state
		// would stay at the defaults and these assertions would fail.
		useCommandPaletteStore.setState({ recentSearches: [], pinnedUrls: [] });
		localStorage.setItem("command-palette-state", JSON.stringify({ state: { recentSearches: [RECENT], pinnedUrls: ["/docs"] }, version: 0 }));

		await useCommandPaletteStore.persist.rehydrate();

		const state = useCommandPaletteStore.getState();
		expect(state.recentSearches).toEqual([RECENT]);
		expect(state.pinnedUrls).toEqual(["/docs"]);
	});

	it("caps recents at MAX_RECENT and de-dupes by url", () => {
		const add = useCommandPaletteStore.getState().addRecentSearch;
		for (let index = 0; index < 8; index += 1) {
			add({ title: `Page ${String(index)}`, url: `/page-${String(index)}`, section: "Main" });
		}
		// The most recent entry (index 7) is first; the oldest two fell off.
		const state = useCommandPaletteStore.getState();
		expect(state.recentSearches[0]?.url).toBe("/page-7");
		expect(state.recentSearches).toHaveLength(6);

		// Re-adding an existing url moves it to the front instead of duplicating.
		add({ title: "Page 3", url: "/page-3", section: "Main" });
		const after = useCommandPaletteStore.getState().recentSearches;
		expect(after[0]?.url).toBe("/page-3");
		expect(after.filter((entry) => entry.url === "/page-3")).toHaveLength(1);
	});

	it("ignores a corrupted persisted payload without clobbering live state", async () => {
		// Seed a non-default value first: a corrupt payload must not overwrite the
		// live state (the merge falls back to the current state untouched).
		useCommandPaletteStore.getState().addRecentSearch(RECENT);
		localStorage.setItem("command-palette-state", JSON.stringify({ state: { recentSearches: "nope", pinnedUrls: 42 }, version: 0 }));

		await useCommandPaletteStore.persist.rehydrate();

		const state = useCommandPaletteStore.getState();
		// Live state survives; nothing from the garbage payload leaked in.
		expect(state.recentSearches).toEqual([RECENT]);
		expect(state.pinnedUrls).toEqual([]);
	});

	it("never writes search text to storage (the query is component-local, not persisted)", () => {
		useCommandPaletteStore.getState().addRecentSearch(RECENT);
		useCommandPaletteStore.getState().togglePinnedUrl("/docs");

		const raw = localStorage.getItem("command-palette-state");
		expect(raw).not.toBeNull();
		const parsed = StoredPalettePayloadSchema.safeParse(JSON.parse(raw ?? "{}"));
		if (parsed.success) {
			// Only the deliberate preference keys are stored — no search text.
			expect(parsed.data.state).not.toHaveProperty("searchText");
			expect(parsed.data.state).not.toHaveProperty("searchQuery");
			expect(parsed.data.state.pinnedUrls).toEqual(["/docs"]);
		} else {
			throw new Error("stored payload did not match the expected shape");
		}
	});
});
