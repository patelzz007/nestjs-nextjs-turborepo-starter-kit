import { buildMerchantPaletteItems } from "@/lib/palette/nav-items";
import type { MerchantCapability } from "@workspace/shared";
import { resolvePinnedMenuItems } from "@workspace/ui/lib/resolve-pinned-menu-items";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";

/** Resolves command-palette pinned URLs to flat menu entries for the sidebar favorites row. */
export function resolveMerchantPinnedMenuItems(
	pinnedUrls: readonly string[],
	capabilities: readonly MerchantCapability[],
): readonly PaletteSearchableItem[] {
	return resolvePinnedMenuItems(pinnedUrls, buildMerchantPaletteItems(capabilities));
}
