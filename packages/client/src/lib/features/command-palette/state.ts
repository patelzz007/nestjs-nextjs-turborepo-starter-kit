import { PaletteRecentSearchSchema } from "@workspace/ui/lib/palette/types";
import { z } from "zod";

/**
 * A page the user opened from the command palette (a "Recent" chip). Same
 * fields as the palette's own recent-search contract, but unknown keys are
 * stripped instead of rejected, so one odd entry in storage written by an
 * older build does not throw away every other saved shortcut.
 */
const RecentSearchSchema = z.object(PaletteRecentSearchSchema.shape);

export type CommandPaletteRecentSearch = z.output<typeof RecentSearchSchema>;

const commandPaletteStateShape = {
	/** Pages recently opened from the palette, newest first (persisted, capped). */
	recentSearches: z.array(RecentSearchSchema).readonly(),
	/** Pinned page URLs, most recently pinned first (persisted). */
	pinnedUrls: z.array(z.string()).readonly(),
};

/**
 * Command palette UI state (web, admin, merchant). Owner: Zustand — browser-only
 * shortcuts shared by the palette, the topbar and the sidebar's pinned row.
 * Every field is a deliberate user preference, so all of it survives a reload.
 *
 * NOT here, deliberately: the palette's search text (local component state —
 * resets on close/refresh) and the searchable pages (static per app, filtered
 * by the session's route access).
 */
const CommandPaletteStateSchema = z.object(commandPaletteStateShape).readonly();

export type CommandPaletteState = z.output<typeof CommandPaletteStateSchema>;

export const INITIAL_COMMAND_PALETTE_STATE: CommandPaletteState = {
	recentSearches: [],
	pinnedUrls: [],
};

/** Most recent searches kept — the oldest entry drops off when a new one is recorded. */
export const MAX_RECENT_SEARCHES = 6;

/**
 * What builds before the feature store wrote (`zustand/persist`'s envelope with
 * optional fields) — read once and upgraded, so nobody loses their shortcuts.
 */
const LegacyCommandPalettePreferencesSchema = z.object({ state: z.object(commandPaletteStateShape).partial() }).transform(({ state }): CommandPaletteState => ({
	recentSearches: state.recentSearches ?? INITIAL_COMMAND_PALETTE_STATE.recentSearches,
	pinnedUrls: state.pinnedUrls ?? INITIAL_COMMAND_PALETTE_STATE.pinnedUrls,
}));

/** The persisted snapshot — validated on the way back in, never trusted. */
export const CommandPalettePreferencesSchema = z.union([CommandPaletteStateSchema, LegacyCommandPalettePreferencesSchema]);

export type CommandPalettePreferences = z.output<typeof CommandPalettePreferencesSchema>;
