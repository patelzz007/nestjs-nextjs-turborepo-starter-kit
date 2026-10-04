import { z } from "zod";

/** How a rewards catalog lays out its offers: tiles in a grid, or compact rows in a list. */
export const RewardsViewModeSchema = z.enum(["grid", "list"]);

export type RewardsViewMode = z.output<typeof RewardsViewModeSchema>;

const uiPreferencesStateShape = {
	/** Layout of the rewards catalog (web browse + landing, merchant rewards) (persisted). */
	rewardsViewMode: RewardsViewModeSchema,
};

/**
 * The user's display preferences (web, merchant). Owner: Zustand — browser-only
 * choices that several screens read and that should survive a reload. Every
 * field is a deliberate preference, so all of it is persisted.
 *
 * NOT here, deliberately: the colour theme (`next-themes` owns it), data table
 * column/density preferences (the `packages/ui` data table keeps those itself
 * and stays store-free), and anything shareable or bookmarkable (the URL).
 */
const UiPreferencesStateSchema = z.object(uiPreferencesStateShape).readonly();

export type UiPreferencesState = z.output<typeof UiPreferencesStateSchema>;

export const INITIAL_UI_PREFERENCES_STATE: UiPreferencesState = {
	rewardsViewMode: "grid",
};

/** The current (version 1) persisted snapshot — validated on the way back in, never trusted. */
export const UiPreferencesSchema = UiPreferencesStateSchema;

export type UiPreferences = z.output<typeof UiPreferencesSchema>;

/** Version of `UiPreferencesSchema`; bump it with a migration when the snapshot changes. */
export const UI_PREFERENCES_VERSION = 1;

/**
 * The first feature store's bare snapshot (JSON, written before version 1).
 * The view-mode helpers before it stored the mode as a bare, non-JSON string
 * (`list`) — `LegacyRewardsViewModeSchema` reads that one.
 */
export const LegacyUiPreferencesSnapshotSchema = UiPreferencesStateSchema;

export const LegacyRewardsViewModeSchema = RewardsViewModeSchema.transform((rewardsViewMode: RewardsViewMode): UiPreferencesState => ({
	...INITIAL_UI_PREFERENCES_STATE,
	rewardsViewMode,
}));
