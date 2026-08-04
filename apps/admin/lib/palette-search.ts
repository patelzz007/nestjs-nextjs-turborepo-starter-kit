import { SIDEBAR_MENU } from "@/config/sidebar-menu";

import { flattenMenuItems, type SearchableMenuItem } from "@/lib/menu";

/** A searchable page entry, flattened from the sidebar menu with its trail. */
export type PaletteSearchableItem = SearchableMenuItem;

const FILLER_WORDS: readonly string[] = [
	"go to",
	"show me",
	"navigate to",
	"open",
	"take me to",
	"i want",
	"find",
	"view",
	"see",
	"show",
	"go",
	"take me",
	"bring me",
	"jump to",
	"head to",
];

function stripFillerWords(input: string): string {
	let result = input.toLowerCase().trim();
	for (const filler of FILLER_WORDS) {
		result = result.replace(new RegExp(`^${filler}\\s+`, "i"), "");
		result = result.replace(new RegExp(`\\s+${filler}\\s+`, "i"), " ");
	}
	return result.trim();
}

function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dpRows: number[][] = [];
	for (let idx = 0; idx <= m; idx++) {
		const row = new Array<number>(n + 1);
		row[0] = idx;
		dpRows.push(row);
	}
	const firstRow = dpRows[0];
	if (firstRow !== undefined) {
		for (let jdx = 0; jdx <= n; jdx++) {
			firstRow[jdx] = jdx;
		}
	}
	for (let i = 1; i <= m; i++) {
		const currentRow = dpRows[i];
		const prevRow = dpRows[i - 1];
		if (currentRow === undefined || prevRow === undefined) {
			continue;
		}
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const topVal = prevRow[j];
			const leftVal = currentRow[j - 1];
			const diagVal = prevRow[j - 1];
			currentRow[j] = Math.min((topVal ?? 0) + 1, (leftVal ?? 0) + 1, (diagVal ?? 0) + cost);
		}
	}
	const lastRow = dpRows[m];
	return lastRow !== undefined ? (lastRow[n] ?? 0) : 0;
}

/** Alias map — alternate search terms for common items. */
const ALIAS_MAP: Readonly<Record<string, readonly string[]>> = {
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

/* ── Scope-prefix helpers ──────────────────────────────────── */

export type ScopeType = "all" | "commands" | "files" | "settings";

export interface ParsedInput {
	readonly scope: ScopeType;
	readonly query: string;
}

export function parseInput(input: string): ParsedInput {
	const trimmed = input.trimStart();
	if (trimmed.startsWith(">")) {
		return { scope: "commands", query: trimmed.slice(1).trimStart() };
	}
	if (trimmed.startsWith("/")) {
		return { scope: "files", query: trimmed.slice(1).trimStart() };
	}
	if (trimmed.startsWith("#")) {
		return { scope: "settings", query: trimmed.slice(1).trimStart() };
	}
	return { scope: "all", query: trimmed };
}

export const scopeConfig: Readonly<Record<ScopeType, { readonly label: string; readonly color: string }>> = {
	all: { label: "", color: "" },
	commands: { label: "Commands", color: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
	files: { label: "Pages", color: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
	settings: { label: "Settings", color: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
};

/* ── Menu flattening — from the typed sidebar config ───────── */

function buildSearchableItems(): readonly PaletteSearchableItem[] {
	const items: PaletteSearchableItem[] = [];
	for (const section of SIDEBAR_MENU.sections) {
		flattenMenuItems(section.items, section.title, [], items);
	}
	flattenMenuItems(SIDEBAR_MENU.bottomItems, "Account", [], items);
	return items;
}

/** All navigable pages, flattened once at module load (menu is static). */
export const SEARCHABLE_ITEMS: readonly PaletteSearchableItem[] = buildSearchableItems();

/* ── Matching logic with natural language support ──────────── */

export function matchesQuery(itemTitle: string, itemBreadcrumb: readonly string[], rawQuery: string): boolean {
	const searchText = `${itemTitle} ${itemBreadcrumb.join(" ")}`.toLowerCase();
	const q = rawQuery.toLowerCase().trim();

	if (searchText.includes(q)) {
		return true;
	}

	if (ALIAS_MAP[q]?.some((t) => itemTitle.toLowerCase().includes(t.toLowerCase())) === true) {
		return true;
	}

	for (const entry of Object.entries(ALIAS_MAP)) {
		const alias = entry[0];
		const targets = entry[1];
		if (alias.includes(q) && targets.some((t) => itemTitle.toLowerCase().includes(t.toLowerCase()))) {
			return true;
		}
	}

	const stripped = stripFillerWords(rawQuery);
	if (stripped.length > 0 && stripped !== rawQuery.toLowerCase().trim()) {
		if (searchText.includes(stripped)) {
			return true;
		}
		if (ALIAS_MAP[stripped]?.some((t) => itemTitle.toLowerCase().includes(t.toLowerCase())) === true) {
			return true;
		}
	}

	return false;
}

/** Closest matching item for a no-result query (Levenshtein "did you mean?"). */
export function findSuggestion(query: string, candidates: readonly PaletteSearchableItem[]): PaletteSearchableItem | null {
	if (query.length < 3) {
		return null;
	}
	const q = query.toLowerCase().trim();
	let bestItem: PaletteSearchableItem | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const item of candidates) {
		// Compare against the full title so multi-word titles ("Buyer Persona")
		// are matched forgivingly, not just against a title truncated to the
		// query length.
		const dist = levenshteinDistance(q, item.title.toLowerCase());
		if (dist < bestDist && dist <= Math.ceil(q.length / 3)) {
			bestDist = dist;
			bestItem = item;
		}
	}
	return bestItem;
}
