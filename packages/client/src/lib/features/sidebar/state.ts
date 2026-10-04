import { z } from "zod";

/**
 * Nav branches the user opened or closed by hand, on ONE page. Route-driven
 * auto-expansion (the active item's ancestors) is the default everywhere;
 * these choices override it, but only on the page they were made on — on any
 * other page they are simply not read, so branches opened for the previous
 * route never stay open and nothing has to "reset" them. Keys are in the order
 * they were last toggled (newest last).
 */
export interface SidebarManualExpansion {
	readonly pathname: string;
	readonly items: Readonly<Record<string, boolean>>;
}

/**
 * Panel sidebar UI state (web, admin, merchant). Owner: Zustand — it is
 * browser-only UI coordinated by the rail, topbar, search box and nav tree.
 *
 * NOT here, deliberately: the menu (static per app — import the app's compiled
 * menu constant) and the current page (URL state — `usePathname()`).
 */
export interface SidebarState {
	/** Desktop rail expanded (persisted). */
	readonly isOpen: boolean;
	/** Custom section order; `null` = the menu's own order (persisted). */
	readonly sectionOrder: readonly string[] | null;
	/** Manual expand/collapse choices for one page (persisted, capped to the newest). */
	readonly manualExpansion: SidebarManualExpansion | null;
	/** Sidebar search text (session only). */
	readonly searchQuery: string;
}

export const INITIAL_SIDEBAR_STATE: SidebarState = {
	isOpen: true,
	sectionOrder: null,
	manualExpansion: null,
	searchQuery: "",
};

/** Most manual expand/collapse choices kept for a page — the oldest are dropped first. */
export const MAX_MANUAL_EXPANDED_ITEMS = 20;

/** Longest pathname / item id accepted back from storage (stored data is untrusted). */
const MAX_STORED_TEXT_LENGTH = 2048;

/** Longest stored section order accepted back from storage. */
const MAX_STORED_SECTIONS = 100;

const StoredTextSchema = z.string().min(1).max(MAX_STORED_TEXT_LENGTH);

/** The current (version 1) persisted snapshot — validated on the way back in, never trusted. */
export const SidebarPreferencesSchema = z.object({
	isOpen: z.boolean(),
	sectionOrder: z.array(StoredTextSchema).max(MAX_STORED_SECTIONS).nullable(),
	manualExpansion: z.object({ pathname: StoredTextSchema, items: z.record(StoredTextSchema, z.boolean()) }).nullable(),
});

export type SidebarPreferences = z.output<typeof SidebarPreferencesSchema>;

/** Version of `SidebarPreferencesSchema`; bump it with a migration when the snapshot changes. */
export const SIDEBAR_PREFERENCES_VERSION = 1;

/**
 * Everything builds before version 1 wrote under the same key: `zustand/persist`'s
 * envelope (`{ state: {…}, version: 0 }`, fields optional) and the first feature
 * store's bare snapshot. Their `expandedItems` were never route-scoped (and were
 * reset on every mount), so they are dropped; the rail and section order carry over.
 */
export const LegacySidebarPreferencesSchema = z.union([
	z.object({ isOpen: z.boolean(), sectionOrder: z.array(StoredTextSchema).max(MAX_STORED_SECTIONS).nullable() }),
	z
		.object({ state: z.object({ isOpen: z.boolean(), sectionOrder: z.array(StoredTextSchema).max(MAX_STORED_SECTIONS).nullable() }).partial() })
		.transform(({ state }): { isOpen: boolean; sectionOrder: string[] | null } => ({
			isOpen: state.isOpen ?? INITIAL_SIDEBAR_STATE.isOpen,
			sectionOrder: state.sectionOrder ?? null,
		})),
]);
