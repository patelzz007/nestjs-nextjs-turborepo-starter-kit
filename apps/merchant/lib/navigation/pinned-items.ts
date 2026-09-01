import { MERCHANT_PALETTE_ITEMS } from "@/lib/palette/nav-items";
import { resolvePinnedMenuItems } from "@workspace/ui/lib/resolve-pinned-menu-items";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";

/** Resolves command-palette pinned URLs to flat menu entries for the sidebar favorites row. */
export function resolveMerchantPinnedMenuItems(pinnedUrls: readonly string[]): readonly PaletteSearchableItem[] {
	return resolvePinnedMenuItems(pinnedUrls, MERCHANT_PALETTE_ITEMS);
}
