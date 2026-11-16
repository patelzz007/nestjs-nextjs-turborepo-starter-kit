// The filter bar's text and path rules, shared by the web and native kits: field paths as keys, folding text for
// search, exclusive picks, the combinator word a row shows, and id factories.

/** Separator between path segments in the flat map keys; a control char cannot collide with a field id. */
const PATH_SEPARATOR = "\u0000";
/** Root key for `childrenOf`. */
export const FILTER_ROOT_KEY = `${PATH_SEPARATOR}root`;
/** The row a combinator word toggles on: the second (the first says "where"). */
const COMBINATOR_TOGGLE_INDEX = 1;

export type FilterCombinatorSlot = "where" | "toggle" | "echo";

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

/** `toLocaleLowerCase`, so Turkish dotted and dotless i fold as a reader expects. */
export function foldFilterText(text: string): string {
	return text.toLocaleLowerCase();
}

export function normalizeFilterQuery(query: string): string {
	return foldFilterText(query.trim());
}

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
