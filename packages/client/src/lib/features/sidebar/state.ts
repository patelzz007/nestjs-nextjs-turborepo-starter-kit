import { z } from "zod";

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
	/** Manually expanded nav branches (persisted, capped). */
	readonly expandedItems: Readonly<Record<string, boolean>>;
	/** Sidebar search text (session only). */
	readonly searchQuery: string;
}

export const INITIAL_SIDEBAR_STATE: SidebarState = {
	isOpen: true,
	sectionOrder: null,
	expandedItems: {},
	searchQuery: "",
};

/** Most expanded branches kept in storage — older entries beyond this are dropped. */
export const MAX_PERSISTED_EXPANDED_ITEMS = 20;

const sidebarPreferencesShape = {
	isOpen: z.boolean(),
	sectionOrder: z.array(z.string()).nullable(),
	expandedItems: z.record(z.string(), z.boolean()),
};

/** The slice that survives a reload — validated on the way back in, never trusted. */
const CurrentSidebarPreferencesSchema = z.object(sidebarPreferencesShape);

/**
 * What builds before the feature store wrote (`zustand/persist`'s envelope with
 * optional fields) — read once and upgraded, so nobody loses their layout.
 */
const LegacySidebarPreferencesSchema = z
	.object({ state: z.object(sidebarPreferencesShape).partial() })
	.transform(({ state }): z.output<typeof CurrentSidebarPreferencesSchema> => ({
		isOpen: state.isOpen ?? INITIAL_SIDEBAR_STATE.isOpen,
		sectionOrder: state.sectionOrder ?? null,
		expandedItems: state.expandedItems ?? {},
	}));

export const SidebarPreferencesSchema = z.union([CurrentSidebarPreferencesSchema, LegacySidebarPreferencesSchema]);

export type SidebarPreferences = z.output<typeof SidebarPreferencesSchema>;
