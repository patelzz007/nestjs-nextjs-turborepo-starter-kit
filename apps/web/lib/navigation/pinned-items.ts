import { WEB_PALETTE_ITEMS } from "@/lib/palette/nav-items";
import { resolvePinnedMenuItems } from "@workspace/ui/lib/palette/resolve-pinned-menu-items";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";

/**
 * Resolves command-palette pinned URLs to flat menu entries for the sidebar
 * favorites row. Pass the **accessible** palette entries, so a pin to a page
 * the session can no longer open simply drops out.
 */
export function resolveWebPinnedMenuItems(
	pinnedUrls: readonly string[],
	searchableItems: readonly PaletteSearchableItem[] = WEB_PALETTE_ITEMS,
): readonly PaletteSearchableItem[] {
	return resolvePinnedMenuItems(pinnedUrls, searchableItems);
}
