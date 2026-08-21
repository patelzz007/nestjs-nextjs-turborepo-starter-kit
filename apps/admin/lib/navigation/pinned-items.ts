import type { SearchableMenuItem } from "@/lib/navigation/menu";
import { SEARCHABLE_ITEMS } from "@/lib/palette/search";

const SEARCHABLE_ITEMS_BY_URL = new Map<string, SearchableMenuItem>(SEARCHABLE_ITEMS.map((item) => [item.url, item]));

/** Resolves command-palette pinned URLs to flat menu entries for the sidebar favorites row. */
export function resolvePinnedMenuItems(pinnedUrls: readonly string[]): readonly SearchableMenuItem[] {
	const resolved: SearchableMenuItem[] = [];
	const seenUrls = new Set<string>();
	for (const url of pinnedUrls) {
		if (seenUrls.has(url)) {
			continue;
		}
		const item = SEARCHABLE_ITEMS_BY_URL.get(url);
		if (item !== undefined) {
			seenUrls.add(url);
			resolved.push(item);
		}
	}
	return resolved;
}
