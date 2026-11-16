import { createNoopSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/components/sidebar";

/**
 * The sidebar examples' open state lives in memory only. The provider's default
 * storage is the app shell's own cookie, so without this a demo toggle on the
 * `/components` page would also collapse the admin panel's real sidebar.
 */
export const SIDEBAR_EXAMPLE_STORAGE: SidebarStorageAdapter = createNoopSidebarStorage();

/**
 * The bounded frame every sidebar example renders in. A fixed height (with
 * `min-h-0` to replace the provider's `min-h-svh`) and `relative` +
 * `overflow-hidden`, so the panel — given `absolute h-full` in place of its
 * desktop `fixed inset-y-0 h-svh` — measures against the example, not the viewport.
 */
export const SIDEBAR_EXAMPLE_FRAME_CLASS_NAME = "relative h-120 min-h-0 w-full overflow-hidden";

/** Swaps the desktop panel's viewport positioning for the example frame's. */
export const SIDEBAR_EXAMPLE_PANEL_CLASS_NAME = "absolute h-full";
