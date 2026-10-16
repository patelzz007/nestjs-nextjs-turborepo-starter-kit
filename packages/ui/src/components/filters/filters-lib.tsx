import { isArrayValue, isStringPrimitive } from "@workspace/shared";
import { z } from "zod";

import type { FilterField, FilterIndex, FilterIndexEntry, FilterOperator, FilterOption } from "./filters-types";

/* -------------------------------------------------------------------------- */
/*                                    Menus                                   */
/* -------------------------------------------------------------------------- */

/**
 * One menu size for the chip's kebab and the builder's menus, which draw the
 * same rows. `w-max` overrides the anchor-width default so a menu hung off an
 * icon button never cuts a longer row; the cap stops a pathological label
 * pushing the menu off a phone, past which a row truncates rather than wraps.
 */
export const FILTER_MENU_CLASS = "w-max min-w-32 max-w-[min(24rem,calc(100vw-2rem))] [&_[data-slot=dropdown-menu-item]]:min-w-0";

/** What a menu row's LABEL wears: a real span, so `truncate` has a box. */
export const FILTER_MENU_LABEL_CLASS = "min-w-0 truncate";

/** The FIELD PICKER's panel, shared by the Add filter popover and the builder's attribute cell. */
export const FILTER_FIELD_PICKER_CLASS = "w-auto min-w-56 p-0";

/* -------------------------------------------------------------------------- */
/*                                    Paths                                   */
/* -------------------------------------------------------------------------- */

/** Separator between path segments in the flat map keys; a control char cannot collide with a field id. */
const PATH_SEPARATOR = "\u0000";

/** Root key for `childrenOf`. */
export const FILTER_ROOT_KEY = `${PATH_SEPARATOR}root`;

export function joinFilterPath(path: readonly string[]): string {
	return path.join(PATH_SEPARATOR);
}

export function splitFilterPath(key: string): string[] {
	return key === "" ? [] : key.split(PATH_SEPARATOR);
}

/** The joined key of a path's parent, or `FILTER_ROOT_KEY` at the top level. */
export function parentFilterKey(path: readonly string[]): string {
	return path.length <= 1 ? FILTER_ROOT_KEY : joinFilterPath(path.slice(0, -1));
}

/** Whether two paths name the same field. */
export function isSameFilterPath(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((segment: string, index: number): boolean => segment === right[index]);
}

/* -------------------------------------------------------------------------- */
/*                                  Signature                                 */
/* -------------------------------------------------------------------------- */

function flag(value: boolean | undefined): string {
	return value === true ? "1" : "0";
}

function editorSignature(field: FilterField): string {
	const { editor } = field;
	if (editor === undefined) {
		return "";
	}
	return isStringPrimitive(editor) ? editor : "fn";
}

function operatorsSignature(field: FilterField): string {
	const { operators } = field;
	if (operators === undefined) {
		return "";
	}
	if (isArrayValue(operators)) {
		return operators.map((operator: FilterOperator): string => operator.value).join(",");
	}
	return "fn";
}

function optionsSignature(field: FilterField): string {
	// Options are part of the shape, and `exclusive` rides along: it decides what
	// a pick DOES, so turning it on must force a rebuild.
	return (field.options ?? []).map((option: FilterOption): string => `${option.value}~${option.label}${option.exclusive === true ? "~x" : ""}`).join(",");
}

/**
 * A content hash of the schema, used to skip a rebuild. Identity alone is
 * useless: call sites declare `fields` as an inline literal, so a memo keyed on
 * the array misses on every parent render. Render props are hashed by PRESENCE
 * only, because inline JSX recreates them.
 */
export function computeFilterSchemaSignature(fields: readonly FilterField[]): string {
	const parts: string[] = [];
	const walk = (list: readonly FilterField[], depth: number): void => {
		for (const field of list) {
			parts.push(
				[
					`${String(depth)}:${field.id}`,
					field.label,
					field.type ?? "",
					field.defaultOperator ?? "",
					field.column ?? "",
					flag(field.selectable) +
						flag(field.disabled) +
						flag(field.icon != null) +
						flag(field.renderValue != null) +
						flag(field.loadOptions != null) +
						flag(field.resolveValues != null),
					editorSignature(field),
					(field.keywords ?? []).join(","),
					field.count === undefined ? "" : String(field.count),
					optionsSignature(field),
					operatorsSignature(field),
				].join("|"),
			);
			if (field.fields !== undefined && field.fields.length > 0) {
				walk(field.fields, depth + 1);
			}
		}
	};
	walk(fields, 0);
	return parts.join("\n");
}

/* -------------------------------------------------------------------------- */
/*                                    Index                                   */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes a field schema into flat maps. When `previous`'s signature
 * matches, the PREVIOUS OBJECT is returned so every downstream memo holds.
 * Duplicate sibling ids are ignored after the first; `findFilterSchemaIssues`
 * reports them in development.
 */
export function buildFilterIndex(fields: readonly FilterField[], previous?: FilterIndex | null, precomputedSignature?: string): FilterIndex {
	const signature = precomputedSignature ?? computeFilterSchemaSignature(fields);
	if (previous?.signature === signature) {
		return previous;
	}

	const byPath = new Map<string, FilterField>();
	const childrenOf = new Map<string, readonly FilterField[]>();
	const parentOf = new Map<string, string>();
	const all: FilterIndexEntry[] = [];
	const roots: FilterField[] = [];

	const walk = (list: readonly FilterField[], parentPath: readonly string[], parentKey: string): void => {
		const accepted: FilterField[] = [];
		const seen = new Set<string>();
		for (const field of list) {
			if (seen.has(field.id)) {
				continue;
			}
			seen.add(field.id);
			const path = [...parentPath, field.id];
			const key = joinFilterPath(path);
			byPath.set(key, field);
			parentOf.set(key, parentKey === FILTER_ROOT_KEY ? "" : parentKey);
			all.push({ field, path });
			accepted.push(field);
			if (field.fields !== undefined && field.fields.length > 0) {
				walk(field.fields, path, key);
			}
		}
		childrenOf.set(parentKey, accepted);
		if (parentKey === FILTER_ROOT_KEY) {
			roots.push(...accepted);
		}
	};
	walk(fields, [], FILTER_ROOT_KEY);

	return { byPath, childrenOf, parentOf, all, roots, signature };
}

/** How many distinct schemas `getCachedFilterIndex` remembers. */
const INDEX_CACHE_SIZE = 32;
const indexCache = new Map<string, FilterIndex>();

/**
 * The index for a schema, shared by content: equal schemas (same signature)
 * get the SAME index object, so a root re-rendered with an inline `fields`
 * literal republishes nothing. A small bounded cache, oldest evicted first.
 */
export function getCachedFilterIndex(fields: readonly FilterField[], signature: string = computeFilterSchemaSignature(fields)): FilterIndex {
	const cached = indexCache.get(signature);
	if (cached !== undefined) {
		return cached;
	}
	const built = buildFilterIndex(fields, null, signature);
	indexCache.set(signature, built);
	if (indexCache.size > INDEX_CACHE_SIZE) {
		const [oldest] = indexCache.keys();
		if (oldest !== undefined) {
			indexCache.delete(oldest);
		}
	}
	return built;
}

export function getFilterField(index: FilterIndex, path: readonly string[]): FilterField | undefined {
	return index.byPath.get(joinFilterPath(path));
}

/** The ancestor chain for a path, root first and the field itself last. */
export function getFilterFieldChain(index: FilterIndex, path: readonly string[]): FilterField[] {
	const chain: FilterField[] = [];
	for (let depth = 1; depth <= path.length; depth += 1) {
		const field = index.byPath.get(joinFilterPath(path.slice(0, depth)));
		if (field === undefined) {
			break;
		}
		chain.push(field);
	}
	return chain;
}

/** Child fields of a path. Pass an empty path for the root level. */
export function getFilterChildren(index: FilterIndex, path: readonly string[]): readonly FilterField[] {
	const key = path.length === 0 ? FILTER_ROOT_KEY : joinFilterPath(path);
	return index.childrenOf.get(key) ?? [];
}

export function isFilterBranch(field: FilterField): boolean {
	return field.fields !== undefined && field.fields.length > 0;
}

/**
 * Whether a field DECLARES itself filterable: leaves always, a branch only with
 * `selectable`. The shipped pickers ignore it, see `isFilterFieldPickable`.
 */
export function isFilterFieldSelectable(field: FilterField): boolean {
	if (field.disabled === true) {
		return false;
	}
	return isFilterBranch(field) ? field.selectable === true : true;
}

/**
 * Whether the SHIPPED pickers may commit a field: leaves only. A row that both
 * drills in and commits cannot disambiguate a click.
 */
export function isFilterFieldPickable(field: FilterField): boolean {
	if (field.disabled === true) {
		return false;
	}
	return !isFilterBranch(field);
}

/** Trailing count for a branch row. */
export function getFilterFieldCount(field: FilterField): number {
	return field.count ?? field.fields?.length ?? 0;
}

/** Renders a path as "Name > First" using the caller's separator. */
export function formatFilterPath(index: FilterIndex, path: readonly string[], separator: string): string {
	const chain = getFilterFieldChain(index, path);
	if (chain.length === 0) {
		return path.join(separator);
	}
	return chain.map((field: FilterField): string => field.label).join(separator);
}

/** How a long path is shortened. */
export const FILTER_PATH_COLLAPSE_MODES: readonly ["middle", "start", "none"] = ["middle", "start", "none"];
export const FilterPathCollapseSchema = z.enum(FILTER_PATH_COLLAPSE_MODES);
export type FilterPathCollapse = z.infer<typeof FilterPathCollapseSchema>;

/** How many names survive a collapse when the caller names no number. */
export const DEFAULT_FILTER_MAX_PATH_SEGMENTS = 3;

export type FilterPathSegment =
	| { readonly type: "field"; readonly field: FilterField }
	/** The run that was elided, kept so a host can surface it. */
	| { readonly type: "ellipsis"; readonly hidden: readonly FilterField[] };

export interface FilterPathCollapseOptions {
	readonly maxSegments?: number | undefined;
	readonly collapse?: FilterPathCollapse | undefined;
}

function asFieldSegments(chain: readonly FilterField[]): FilterPathSegment[] {
	return chain.map((field: FilterField): FilterPathSegment => ({ type: "field", field }));
}

/**
 * Shortens an ancestor chain to at most `maxSegments` names. `"start"` keeps
 * the tail; `"middle"` keeps the root for orientation and as much of the tail
 * as fits. Default `"none"`: no upgrade shortens a path.
 */
export function collapseFilterPath(chain: readonly FilterField[], options: FilterPathCollapseOptions = {}): FilterPathSegment[] {
	const maxSegments = options.maxSegments ?? DEFAULT_FILTER_MAX_PATH_SEGMENTS;
	const collapse = options.collapse ?? "none";
	if (collapse === "none" || maxSegments <= 0 || chain.length <= maxSegments) {
		return asFieldSegments(chain);
	}
	if (collapse === "start") {
		const cut = chain.length - maxSegments;
		return [{ type: "ellipsis", hidden: chain.slice(0, cut) }, ...asFieldSegments(chain.slice(cut))];
	}
	const tailCount = maxSegments - 1;
	const hidden = chain.slice(1, chain.length - tailCount);
	if (hidden.length === 0) {
		return asFieldSegments(chain);
	}
	return [...asFieldSegments(chain.slice(0, 1)), { type: "ellipsis", hidden }, ...asFieldSegments(chain.slice(chain.length - tailCount))];
}

/* -------------------------------------------------------------------------- */
/*                                 Combinator                                 */
/* -------------------------------------------------------------------------- */

export type FilterCombinatorSlot = "where" | "toggle" | "echo";

/** The position of the one interactive combinator slot in a group. */
const COMBINATOR_TOGGLE_INDEX = 1;

/**
 * Which of the three forms the combinator slot before rule `index` takes. A
 * group has exactly ONE combinator, so only one slot may be interactive.
 */
export function filterCombinatorSlot(index: number): FilterCombinatorSlot {
	if (index === 0) {
		return "where";
	}
	return index === COMBINATOR_TOGGLE_INDEX ? "toggle" : "echo";
}

/* -------------------------------------------------------------------------- */
/*                                   Matching                                 */
/* -------------------------------------------------------------------------- */

/** `toLocaleLowerCase`, so Turkish dotted and dotless i fold as a reader expects. */
export function foldFilterText(text: string): string {
	return text.toLocaleLowerCase();
}

export function normalizeFilterQuery(query: string): string {
	return foldFilterText(query.trim());
}

function matchesText(label: string, keywords: readonly string[] | undefined, normalizedQuery: string): boolean {
	if (normalizedQuery === "" || foldFilterText(label).includes(normalizedQuery)) {
		return true;
	}
	return (keywords ?? []).some((keyword: string): boolean => foldFilterText(keyword).includes(normalizedQuery));
}

/** Whether a field matches a normalized query, by label or keywords. */
export function matchesFilterQuery(field: FilterField, normalizedQuery: string): boolean {
	return matchesText(field.label, field.keywords, normalizedQuery);
}

/** Filters one level, preserving input order. */
export function filterFilterLevel(fields: readonly FilterField[], normalizedQuery: string): readonly FilterField[] {
	if (normalizedQuery === "") {
		return fields;
	}
	return fields.filter((field: FilterField): boolean => matchesFilterQuery(field, normalizedQuery));
}

/** The most results a deep search returns. */
export const FILTER_DEEP_SEARCH_LIMIT = 200;

/**
 * Searches every PICKABLE field at any depth, because a result the user cannot
 * pick is a dead end.
 */
export function searchFilterDeep(index: FilterIndex, normalizedQuery: string, limit: number = FILTER_DEEP_SEARCH_LIMIT): FilterIndexEntry[] {
	if (normalizedQuery === "") {
		return [];
	}
	const results: FilterIndexEntry[] = [];
	for (const entry of index.all) {
		if (results.length >= limit) {
			break;
		}
		if (isFilterFieldPickable(entry.field) && matchesFilterQuery(entry.field, normalizedQuery)) {
			results.push(entry);
		}
	}
	return results;
}

/** Filters an option list by a normalized query, by label or keywords. */
export function filterFilterOptions(options: readonly FilterOption[], normalizedQuery: string): readonly FilterOption[] {
	if (normalizedQuery === "") {
		return options;
	}
	return options.filter((option: FilterOption): boolean => matchesText(option.label, option.keywords, normalizedQuery));
}

/* -------------------------------------------------------------------------- */
/*                              Exclusive options                             */
/* -------------------------------------------------------------------------- */

/**
 * The None rule, as pure algebra over two selections: pick the `exclusive`
 * option and it is the only pick, pick anything else and it goes. Written
 * against the DELTA: an empty delta is a removal; an exclusive arrival is the
 * whole answer; an ordinary arrival drops every exclusive value; both at once
 * gives it to the LAST exclusive. Returns `next` itself when nothing changed.
 */
export function applyFilterExclusiveSelection(next: readonly string[], previous: readonly string[], isExclusive: (value: string) => boolean): readonly string[] {
	const held = new Set(previous);
	const added = next.filter((value: string): boolean => !held.has(value));
	if (added.length === 0) {
		return next;
	}
	const arrived = added.filter(isExclusive).at(-1);
	if (arrived !== undefined) {
		return [arrived];
	}
	const kept = next.filter((value: string): boolean => !isExclusive(value));
	return kept.length === next.length ? next : kept;
}

/* -------------------------------------------------------------------------- */
/*                                     Ids                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds a deterministic id generator. `Date.now()` / `Math.random()` give the
 * server and the client different ids for the same query, which breaks hydration.
 */
export function createFilterIdFactory(seed: string): () => string {
	let counter = 0;
	return (): string => {
		counter += 1;
		return `${seed}${String(counter)}`;
	};
}

/* -------------------------------------------------------------------------- */
/*                              Development checks                            */
/* -------------------------------------------------------------------------- */

const warned = new Set<string>();

/** Warns once per key. Never throws, and is a no-op in production. */
export function warnFilterOnce(key: string, message: string): void {
	if (process.env.NODE_ENV === "production" || warned.has(key)) {
		return;
	}
	warned.add(key);
	console.warn(`[filters] ${message}`);
}

/** Clears the warn-once memory. For tests. */
export function resetFilterWarnings(): void {
	warned.clear();
}

export interface FilterSchemaIssues {
	/** Ids that collide with a sibling. */
	readonly duplicatePaths: readonly string[];
	/** Ids that are empty. */
	readonly emptyIds: readonly string[];
	/** Branches that declare `selectable` but hold no children. */
	readonly emptyBranches: readonly string[];
	/** Fields whose `defaultOperator` is not in their operator list. */
	readonly unknownDefaultOperators: readonly string[];
}

/** Reported, never thrown: a bad schema must degrade, not blank the page. */
export function findFilterSchemaIssues(fields: readonly FilterField[], resolveOperators: (field: FilterField) => readonly FilterOperator[]): FilterSchemaIssues {
	const duplicatePaths: string[] = [];
	const emptyIds: string[] = [];
	const emptyBranches: string[] = [];
	const unknownDefaultOperators: string[] = [];

	const walk = (list: readonly FilterField[], parentPath: readonly string[]): void => {
		const seen = new Set<string>();
		for (const field of list) {
			const label = [...parentPath, field.id].join(".");
			if (field.id === "") {
				emptyIds.push(label);
			} else if (seen.has(field.id)) {
				duplicatePaths.push(label);
			}
			seen.add(field.id);
			if (field.selectable === true && field.fields?.length === 0) {
				emptyBranches.push(label);
			}
			const { defaultOperator } = field;
			if (defaultOperator !== undefined && !resolveOperators(field).some((operator: FilterOperator): boolean => operator.value === defaultOperator)) {
				unknownDefaultOperators.push(`${label} -> ${defaultOperator}`);
			}
			if (field.fields !== undefined && field.fields.length > 0) {
				walk(field.fields, [...parentPath, field.id]);
			}
		}
	};
	walk(fields, []);
	return { duplicatePaths, emptyIds, emptyBranches, unknownDefaultOperators };
}
