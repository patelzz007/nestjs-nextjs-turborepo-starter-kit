import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";

/** Resolves command-palette pinned URLs to flat menu entries for the sidebar favorites row. */
export function resolvePinnedMenuItems(pinnedUrls: readonly string[], searchableItems: readonly PaletteSearchableItem[]): readonly PaletteSearchableItem[] {
	const byUrl = new Map<string, PaletteSearchableItem>(searchableItems.map((item) => [item.url, item]));
	const resolved: PaletteSearchableItem[] = [];
	const seenUrls = new Set<string>();

	for (const url of pinnedUrls) {
		if (seenUrls.has(url)) {
			continue;
		}
		const item = byUrl.get(url);
		if (item !== undefined) {
			seenUrls.add(url);
			resolved.push(item);
		}
	}

	return resolved;
}
