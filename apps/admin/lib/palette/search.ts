import { flattenMenuItems } from "@/lib/navigation/menu";
import type { CompiledSidebarMenuData } from "@/lib/navigation/sidebar";
import { findSuggestion, matchesQuery as matchesQueryBase, parseInput, ParsedInputSchema, ScopeTypeSchema, scopeConfig } from "@workspace/ui/lib/palette/search";
import type { ParsedInput, ScopeType } from "@workspace/ui/lib/palette/search";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";

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

/**
 * Flattens a menu into palette entries. Callers pass the **authorized**
 * (capability + feature-flag filtered) menu so the palette and pinned
 * favorites never surface pages the sidebar hides.
 */
export function buildSearchableItems(menu: CompiledSidebarMenuData): readonly PaletteSearchableItem[] {
	const items: PaletteSearchableItem[] = [];
	for (const section of menu.sections) {
		flattenMenuItems(section.items, section.title, [], items);
	}
	flattenMenuItems(menu.bottomItems, "Account", [], items);
	return items;
}

export function matchesQuery(itemTitle: string, itemBreadcrumb: readonly string[], rawQuery: string): boolean {
	return matchesQueryBase(itemTitle, itemBreadcrumb, rawQuery, SEARCH_ALIAS_MAP);
}
