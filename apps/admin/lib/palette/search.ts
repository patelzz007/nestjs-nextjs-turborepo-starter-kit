import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { flattenMenuItems } from "@/lib/navigation/menu";
import { findSuggestion, matchesQuery as matchesQueryBase, parseInput, ParsedInputSchema, ScopeTypeSchema, scopeConfig } from "@workspace/ui/lib/palette-search";
import type { ParsedInput, ScopeType } from "@workspace/ui/lib/palette-search";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";

export type { PaletteSearchableItem, ParsedInput, ScopeType };
export { findSuggestion, parseInput, scopeConfig, ScopeTypeSchema, ParsedInputSchema };

/** Alias map — alternate search terms for admin demo menu items. */
export const SEARCH_ALIAS_MAP: Readonly<Record<string, readonly string[]>> = {
	home: ["Overview"],
	dashboard: ["Overview"],
	analytics: ["Analytics"],
	realtime: ["Realtime"],
	reports: ["Reports"],
	sales: ["Sales"],
	marketing: ["Marketing"],
	campaigns: ["Campaigns"],
	segments: ["Segments"],
	audiences: ["Audiences"],
	personas: ["Personas"],
	buyer: ["Buyer Persona"],
	power: ["Power User"],
	users: ["Users", "All Users"],
	people: ["All Users"],
	roles: ["Roles"],
	admins: ["Admins"],
	managers: ["Managers"],
	members: ["Members"],
	keys: ["API Keys"],
	"api key": ["API Keys"],
	settings: ["Settings", "General"],
	general: ["General"],
	security: ["Security"],
	sessions: ["Sessions"],
	audit: ["Audit Log"],
	logs: ["Audit Log"],
	billing: ["Billing"],
	invoice: ["Billing"],
	plan: ["Billing"],
	support: ["Support"],
	feedback: ["Feedback"],
	docs: ["Project Alpha", "Project Beta", "Project Gamma"],
	project: ["Project Alpha", "Project Beta", "Project Gamma"],
	alpha: ["Project Alpha"],
	beta: ["Project Beta"],
	gamma: ["Project Gamma"],
};

function buildSearchableItems(): readonly PaletteSearchableItem[] {
	const items: PaletteSearchableItem[] = [];
	for (const section of SIDEBAR_MENU.sections) {
		flattenMenuItems(section.items, section.title, [], items);
	}
	flattenMenuItems(SIDEBAR_MENU.bottomItems, "Account", [], items);
	return items;
}

/** All navigable admin pages, flattened once at module load. */
export const SEARCHABLE_ITEMS: readonly PaletteSearchableItem[] = buildSearchableItems();

export function matchesQuery(itemTitle: string, itemBreadcrumb: readonly string[], rawQuery: string): boolean {
	return matchesQueryBase(itemTitle, itemBreadcrumb, rawQuery, SEARCH_ALIAS_MAP);
}
