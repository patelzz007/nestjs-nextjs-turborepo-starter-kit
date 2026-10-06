import type { ScopeType } from "@workspace/ui/lib/palette/search";

/**
 * Copy for the app command palette — the `appCommandPalette` family in
 * `UiKitLabels`. The strings live in the language packs (`lib/labels/en.ts`,
 * …); the palette reads them with `useUiKitLabels`. A per-usage `labels`
 * override should be a module constant — it reaches every memoised section.
 */
export interface AppCommandPaletteLabels {
	/** Search input placeholder (the root's `placeholder` prop still wins). */
	readonly placeholder: string;
	/** Keyboard hint shown in the empty search box. */
	readonly shortcutHint: string;
	readonly pinnedSectionTitle: string;
	readonly recentSectionTitle: string;
	readonly quickActionsSectionTitle: string;
	/** Quick-actions heading while the `>` (commands) scope is active. */
	readonly commandsSectionTitle: string;
	readonly pagesSectionTitle: string;
	/** Name of each search scope, shown in the scope chip (`>` commands, `/` pages, `#` settings). */
	readonly scopeLabels: Readonly<Record<ScopeType, string>>;
	readonly clearScopeAriaLabel: (scopeLabel: string) => string;
	readonly expandSectionAriaLabel: (section: string) => string;
	readonly collapseSectionAriaLabel: (section: string) => string;
	readonly pinItemAriaLabel: (title: string) => string;
	readonly unpinItemAriaLabel: (title: string) => string;
	/** Shown under a collapsed section, e.g. `3 items hidden`. */
	readonly hiddenItemsCount: (count: number) => string;
	readonly noResultsTitle: string;
	/** Empty-state hint, split around the inline "clear the filter" button. */
	readonly noResultsHintBefore: string;
	readonly noResultsClearFilter: string;
	readonly noResultsHintAfter: string;
	readonly noResultsForQuery: (query: string) => string;
	readonly didYouMean: (title: string) => string;
	readonly footerNavigate: string;
	readonly footerOpen: string;
	readonly footerClose: string;
	readonly footerPrefix: string;
	/** The Escape key's caption in the footer. */
	readonly escapeKey: string;
}
