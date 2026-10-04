/**
 * Command palette colours — design tokens only, so every app theme (and dark
 * mode) restyles the palette without hunting literal colour classes.
 *
 * Item icons rotate through the semantic soft tints (decorative: the icon sits
 * next to its title, which carries the meaning). Section badges are text, so
 * they use the muted pair, whose contrast tokens-contrast.test.ts guarantees.
 */
const ITEM_ICON_COLORS: readonly string[] = [
	"text-primary bg-primary/10",
	"text-info bg-info-soft",
	"text-success bg-success-soft",
	"text-warning bg-warning-soft",
	"text-destructive bg-destructive-soft",
];

const DEFAULT_ICON_COLOR = "text-primary bg-primary/10";

const SECTION_BADGE_COLOR = "bg-muted text-muted-foreground";

/** The search-match highlight shared with the sidebar (`.search-mark`, `--search-mark-*` tokens). */
export const PALETTE_MARK_CLASS = "search-mark rounded-sm px-0.5 font-semibold";

/** A stable icon tint for a page title (same title → same tint on every render and in every app). */
export function getItemColor(title: string): string {
	let hash = 0;
	for (let i = 0; i < title.length; i++) {
		hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
	}
	const index = ((hash % ITEM_ICON_COLORS.length) + ITEM_ICON_COLORS.length) % ITEM_ICON_COLORS.length;
	return ITEM_ICON_COLORS[index] ?? DEFAULT_ICON_COLOR;
}

/** Every section's badge uses the same token pair — section names are app data, not something this package knows. */
export function getSectionBadgeColor(): string {
	return SECTION_BADGE_COLOR;
}

export function getDefaultIconColor(): string {
	return DEFAULT_ICON_COLOR;
}
