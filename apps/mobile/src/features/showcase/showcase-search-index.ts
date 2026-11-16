import type { Href } from "expo-router";

import { SHOWCASE_FEATURE_INDEX } from "./generated/feature-index";
import { SHOWCASE_CATALOG_ORDER, type ShowcaseCatalogItem } from "./showcase-catalog";
import type { ShowcaseFeatureSummary } from "./showcase-feature";

/** What a search result points at: a whole component, or one feature on its screen. */
export type ShowcaseSearchKind = "component" | "feature";

export interface ShowcaseSearchEntry {
	readonly kind: ShowcaseSearchKind;
	/** Unique across every entry. */
	readonly key: string;
	/** The result's title: the component's name, or the feature's label. */
	readonly title: string;
	/** The component the result belongs to (its own name for a component). */
	readonly componentName: string;
	readonly familyTitle: string;
	readonly href: Href;
	/** Lower-cased, accent-free text the query is matched against. */
	readonly haystack: string;
}

/** How a result's links are built (the showcase's routes in this app). */
export interface ShowcaseSearchRoutes {
	readonly component: (slug: string) => Href;
	readonly feature: (slug: string, anchor: string) => Href;
}

/** The most results the search shows at once, so the list stays short enough to scan. */
export const SHOWCASE_SEARCH_LIMIT = 40;

/** Lower case without accents, so "Fenêtre" matches "fenetre". */
export function foldForSearch(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** Every component and every feature, in catalog order (each component followed by its features). */
export function buildShowcaseSearchEntries(routes: ShowcaseSearchRoutes, catalog: readonly ShowcaseCatalogItem[] = SHOWCASE_CATALOG_ORDER): ShowcaseSearchEntry[] {
	return catalog.flatMap(({ entry, family }: ShowcaseCatalogItem): ShowcaseSearchEntry[] => {
		const component: ShowcaseSearchEntry = {
			kind: "component",
			key: `component:${entry.slug}`,
			title: entry.name,
			componentName: entry.name,
			familyTitle: family.title,
			href: routes.component(entry.slug),
			haystack: foldForSearch(`${entry.name} ${entry.slug} ${entry.description} ${family.title}`),
		};
		const features = (SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? []).map((feature: ShowcaseFeatureSummary): ShowcaseSearchEntry => ({
			kind: "feature",
			key: `feature:${entry.slug}:${feature.anchor}`,
			title: feature.label,
			componentName: entry.name,
			familyTitle: family.title,
			href: routes.feature(entry.slug, feature.anchor),
			haystack: foldForSearch(`${feature.label} ${entry.name} ${entry.slug}`),
		}));
		return [component, ...features];
	});
}

/** Ranks of a match, best first: the title starts with the query, contains it, or only the rest of the entry does. */
const RANK_TITLE_PREFIX = 0;
const RANK_TITLE_CONTAINS = 1;
const RANK_ELSEWHERE = 2;
/** Components outrank their own features at the same match strength. */
const KIND_ORDER: Readonly<Record<ShowcaseSearchKind, number>> = { component: 0, feature: 1 };

function rankOf(entry: ShowcaseSearchEntry, query: string): number {
	const title = foldForSearch(entry.title);
	if (title.startsWith(query)) {
		return RANK_TITLE_PREFIX;
	}
	return title.includes(query) ? RANK_TITLE_CONTAINS : RANK_ELSEWHERE;
}

interface RankedEntry {
	readonly entry: ShowcaseSearchEntry;
	readonly position: number;
	readonly rank: number;
}

/**
 * The entries matching `query`: every word of the query must appear somewhere
 * in an entry. Best matches first (title prefix, then title, then the rest;
 * components before features), catalog order within a rank, at most `limit`.
 */
export function searchShowcase(entries: readonly ShowcaseSearchEntry[], query: string, limit: number = SHOWCASE_SEARCH_LIMIT): ShowcaseSearchEntry[] {
	const folded = foldForSearch(query).trim();
	if (folded.length === 0) {
		return [];
	}
	const words = folded.split(/\s+/u);
	return entries
		.flatMap((entry: ShowcaseSearchEntry, position: number): RankedEntry[] =>
			words.every((word: string): boolean => entry.haystack.includes(word)) ? [{ entry, position, rank: rankOf(entry, folded) }] : [],
		)
		.sort((a: RankedEntry, b: RankedEntry): number => a.rank - b.rank || KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] || a.position - b.position)
		.slice(0, limit)
		.map(({ entry }: RankedEntry): ShowcaseSearchEntry => entry);
}
