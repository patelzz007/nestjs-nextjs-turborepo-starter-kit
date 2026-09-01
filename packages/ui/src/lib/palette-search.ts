import { z } from "zod";

import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";

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

export const ScopeTypeSchema = z.enum(["all", "commands", "files", "settings"]);

export type ScopeType = z.output<typeof ScopeTypeSchema>;

export const ParsedInputSchema = z.object({
	scope: ScopeTypeSchema,
	query: z.string(),
});

export type ParsedInput = z.output<typeof ParsedInputSchema>;

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

export function matchesQuery(itemTitle: string, itemBreadcrumb: readonly string[], rawQuery: string, aliasMap: Readonly<Record<string, readonly string[]>> = {}): boolean {
	const searchText = `${itemTitle} ${itemBreadcrumb.join(" ")}`.toLowerCase();
	const q = rawQuery.toLowerCase().trim();

	if (searchText.includes(q)) {
		return true;
	}

	if (aliasMap[q]?.some((t) => itemTitle.toLowerCase().includes(t.toLowerCase())) === true) {
		return true;
	}

	for (const entry of Object.entries(aliasMap)) {
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
		if (aliasMap[stripped]?.some((t) => itemTitle.toLowerCase().includes(t.toLowerCase())) === true) {
			return true;
		}
	}

	return false;
}

export function findSuggestion(query: string, candidates: readonly PaletteSearchableItem[]): PaletteSearchableItem | null {
	if (query.length < 3) {
		return null;
	}
	const q = query.toLowerCase().trim();
	let bestItem: PaletteSearchableItem | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const item of candidates) {
		const dist = levenshteinDistance(q, item.title.toLowerCase());
		if (dist < bestDist && dist <= Math.ceil(q.length / 3)) {
			bestDist = dist;
			bestItem = item;
		}
	}
	return bestItem;
}
