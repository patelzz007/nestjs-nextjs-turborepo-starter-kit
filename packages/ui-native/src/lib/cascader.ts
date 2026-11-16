// The cascader's tree logic (components/cascader.tsx), the phone port of the
// web kit's cascader model: an index over nested or flat (parent-pointer)
// nodes, the path to a value, search across a level, below it or the whole
// tree, cascading multi-selection (a branch ticks every selectable leaf under
// it), and the text of a path for the field (full, the last part, collapsed
// in the middle or at the start). Pure, so every case is tested without
// rendering. Nodes carry no payload of their own: a caller keeps any extra
// data in its own map, keyed by `value`.

import type * as React from "react";

/** One node of the tree: a branch (with children, or `hasChildren` while they load) or a leaf. */
export interface CascaderNode {
	readonly value: string;
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string | undefined;
	/** Before the label: a glyph, a tile, an avatar, a dot. Decorative. */
	readonly icon?: React.ReactNode;
	readonly children?: readonly CascaderNode[] | undefined;
	/** A branch whose children are loaded on demand (`getChildren`). */
	readonly hasChildren?: boolean | undefined;
	/** A number shown on the row (how many items the branch holds). */
	readonly count?: number | undefined;
	readonly disabled?: boolean | undefined;
	/** More words search matches. */
	readonly keywords?: readonly string[] | undefined;
	/** The heading the node is listed under in its level; nodes of one group are kept together. */
	readonly group?: string | undefined;
}

/** Which nodes can be picked: leaves only, any node, or the caller's rule. */
export type CascaderSelectable = "leaf" | "any" | ((node: CascaderNode) => boolean);

/** Where search looks: the shown level, everything under it, or the whole tree. */
export type CascaderSearchScope = "level" | "deep" | "global";

/** How a picked path is written: every part, the last part, or (several picked) a count. */
export type CascaderValueDisplay = "path" | "leaf" | "count";

/** Where a long path is shortened: in the middle, at the start, or not at all. */
export type CascaderCollapse = "middle" | "start" | "none";

/** A branch's tick in cascading multi-selection. */
export type CascaderCheckState = "checked" | "partial" | "none";

/** The parent key of the top level. */
export const CASCADER_ROOT = "";

export interface CascaderIndex {
	readonly byValue: ReadonlyMap<string, CascaderNode>;
	/** Children by parent value (`CASCADER_ROOT` for the top level). */
	readonly childrenOf: ReadonlyMap<string, readonly CascaderNode[]>;
	readonly parentOf: ReadonlyMap<string, string>;
	readonly roots: readonly CascaderNode[];
}

export interface CascaderIndexOptions {
	/** Flat data: each node's parent value, or `null` / `undefined` at the top. */
	readonly getParent?: ((node: CascaderNode) => string | null | undefined) | undefined;
	/** Children loaded on demand, by parent value. */
	readonly loaded?: ReadonlyMap<string, readonly CascaderNode[]> | undefined;
}

/** Indexes nested nodes (their `children`), flat nodes (`getParent`) and loaded children together. */
export function buildCascaderIndex(items: readonly CascaderNode[], options: CascaderIndexOptions = {}): CascaderIndex {
	const byValue = new Map<string, CascaderNode>();
	const childrenOf = new Map<string, CascaderNode[]>();
	const parentOf = new Map<string, string>();
	const add = (node: CascaderNode, parent: string): void => {
		byValue.set(node.value, node);
		parentOf.set(node.value, parent);
		childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), node]);
		(node.children ?? []).forEach((child: CascaderNode): void => {
			add(child, node.value);
		});
	};
	items.forEach((node: CascaderNode): void => {
		add(node, options.getParent?.(node) ?? CASCADER_ROOT);
	});
	options.loaded?.forEach((children: readonly CascaderNode[], parent: string): void => {
		childrenOf.set(parent, []);
		children.forEach((child: CascaderNode): void => {
			add(child, parent);
		});
	});
	return { byValue, childrenOf, parentOf, roots: childrenOf.get(CASCADER_ROOT) ?? [] };
}

/** Whether the node opens a level: it has children, or they are still to load. */
export function isCascaderBranch(index: CascaderIndex, node: CascaderNode): boolean {
	return (index.childrenOf.get(node.value)?.length ?? 0) > 0 || node.hasChildren === true;
}

/** The nodes from the top down to `value` (empty when it is not in the tree). */
export function cascaderPathOf(index: CascaderIndex, value: string | null | undefined): readonly CascaderNode[] {
	const path: CascaderNode[] = [];
	let current = value ?? undefined;
	while (current !== undefined && current !== CASCADER_ROOT) {
		const node = index.byValue.get(current);
		if (node === undefined) {
			return [];
		}
		path.unshift(node);
		current = index.parentOf.get(current);
	}
	return path;
}

/** Whether `node` can be picked under `selectable`. */
export function isCascaderSelectable(index: CascaderIndex, node: CascaderNode, selectable: CascaderSelectable): boolean {
	if (node.disabled === true) {
		return false;
	}
	if (selectable === "any") {
		return true;
	}
	if (selectable === "leaf") {
		return !isCascaderBranch(index, node);
	}
	return selectable(node);
}

/** Every node under `value` (not itself), depth first. */
export function cascaderDescendantsOf(index: CascaderIndex, value: string): readonly CascaderNode[] {
	return (index.childrenOf.get(value) ?? []).flatMap((child: CascaderNode): CascaderNode[] => [child, ...cascaderDescendantsOf(index, child.value)]);
}

/** The selectable leaves a cascading tick on `node` covers: itself when it is a leaf. */
function cascadeTargetsOf(index: CascaderIndex, node: CascaderNode): readonly CascaderNode[] {
	const nodes = isCascaderBranch(index, node) ? cascaderDescendantsOf(index, node.value) : [node];
	return nodes.filter((candidate: CascaderNode): boolean => !isCascaderBranch(index, candidate) && candidate.disabled !== true);
}

/** A branch's tick from the leaves under it: all picked, some, or none. */
export function cascaderCheckStateOf(index: CascaderIndex, node: CascaderNode, values: readonly string[]): CascaderCheckState {
	const targets = cascadeTargetsOf(index, node);
	const picked = targets.filter((target: CascaderNode): boolean => values.includes(target.value)).length;
	if (picked === 0) {
		return "none";
	}
	return picked === targets.length ? "checked" : "partial";
}

/** The values after a cascading tap on `node`: all its leaves off when all are on, otherwise on (up to `max`). */
export function toggleCascaderCascade(index: CascaderIndex, node: CascaderNode, values: readonly string[], max?: number): readonly string[] {
	const targets = cascadeTargetsOf(index, node).map((target: CascaderNode): string => target.value);
	if (targets.every((target: string): boolean => values.includes(target))) {
		return values.filter((value: string): boolean => !targets.includes(value));
	}
	const added = targets.filter((target: string): boolean => !values.includes(target));
	const room = max === undefined ? added.length : Math.max(max - values.length, 0);
	return [...values, ...added.slice(0, room)];
}

/** The values after a plain tap on `value`: off when on, on when off (unless `max` are already on). */
export function toggleCascaderValue(values: readonly string[], value: string, max?: number): readonly string[] {
	if (values.includes(value)) {
		return values.filter((picked: string): boolean => picked !== value);
	}
	return max !== undefined && values.length >= max ? values : [...values, value];
}

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

/** One search hit, with the path that leads to it. */
export interface CascaderSearchResult {
	readonly node: CascaderNode;
	readonly path: readonly CascaderNode[];
}

const COMBINING_MARKS = /\p{M}/gu;

/** Accents drop and case folds, so "Zurich" finds "Zürich". */
export function foldCascaderText(text: string): string {
	return text.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
}

function matchesQuery(node: CascaderNode, needle: string): boolean {
	return [node.label, node.description ?? "", ...(node.keywords ?? [])].some((text: string): boolean => foldCascaderText(text).includes(needle));
}

/** Search from the level of `parent` (`CASCADER_ROOT` at the top): the level itself, everything under it, or the whole tree. */
export function searchCascader(index: CascaderIndex, query: string, scope: CascaderSearchScope, parent: string = CASCADER_ROOT): readonly CascaderSearchResult[] {
	const needle = foldCascaderText(query.trim());
	if (needle === "") {
		return [];
	}
	let pool: readonly CascaderNode[];
	if (scope === "level") {
		pool = index.childrenOf.get(parent) ?? [];
	} else if (scope === "deep") {
		pool = cascaderDescendantsOf(index, parent);
	} else {
		pool = cascaderDescendantsOf(index, CASCADER_ROOT);
	}
	return pool
		.filter((node: CascaderNode): boolean => matchesQuery(node, needle))
		.map((node: CascaderNode): CascaderSearchResult => ({ node, path: cascaderPathOf(index, node.value) }));
}

/* -------------------------------------------------------------------------- */
/*                                    Paths                                   */
/* -------------------------------------------------------------------------- */

export interface CascaderPathFormat {
	readonly separator: string;
	readonly display: CascaderValueDisplay;
	readonly collapse: CascaderCollapse;
	/** The most parts written before the path is shortened (an ellipsis stands for the rest). */
	readonly maxSegments: number;
}

export const DEFAULT_CASCADER_PATH_FORMAT: CascaderPathFormat = { separator: " / ", display: "path", collapse: "middle", maxSegments: 3 };

const ELLIPSIS = "…";

/** The parts of a path's text, shortened to `maxSegments` (the ellipsis is one part). */
export function cascaderPathSegments(labels: readonly string[], collapse: CascaderCollapse, maxSegments: number): readonly string[] {
	if (collapse === "none" || labels.length <= maxSegments || maxSegments < 2) {
		return labels;
	}
	if (collapse === "start") {
		return [ELLIPSIS, ...labels.slice(labels.length - (maxSegments - 1))];
	}
	const [first = ""] = labels;
	return [first, ELLIPSIS, ...labels.slice(labels.length - (maxSegments - 2))];
}

/** The text of one picked path in `format`. */
export function formatCascaderPath(path: readonly CascaderNode[], format: CascaderPathFormat = DEFAULT_CASCADER_PATH_FORMAT): string {
	const labels = path.map((node: CascaderNode): string => node.label);
	if (format.display === "leaf") {
		return labels.at(-1) ?? "";
	}
	return cascaderPathSegments(labels, format.collapse, format.maxSegments).join(format.separator);
}

/* -------------------------------------------------------------------------- */
/*                                  Flat data                                 */
/* -------------------------------------------------------------------------- */

/** A row as a database returns it: a parent pointer, any order. */
export interface CascaderFlatRow {
	readonly id: string;
	readonly parentId: string | null;
	readonly label: string;
	readonly description?: string | undefined;
}

/** Nests flat rows into nodes, keeping the rows' order within each level; rows whose parent is missing are dropped. */
export function cascaderTreeFromRows(rows: readonly CascaderFlatRow[]): readonly CascaderNode[] {
	const childrenOf = new Map<string | null, CascaderFlatRow[]>();
	rows.forEach((row: CascaderFlatRow): void => {
		childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row]);
	});
	const nest = (parent: string | null): readonly CascaderNode[] =>
		(childrenOf.get(parent) ?? []).map((row: CascaderFlatRow): CascaderNode => {
			const children = nest(row.id);
			return { value: row.id, label: row.label, description: row.description, children: children.length === 0 ? undefined : children };
		});
	return nest(null);
}
