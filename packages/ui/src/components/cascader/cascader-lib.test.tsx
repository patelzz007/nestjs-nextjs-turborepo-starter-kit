// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
	applyCascadeSelection,
	buildCascaderIndex,
	CASCADER_ROOT_KEY,
	collapseCascaderPath,
	collectCascaderSubtree,
	createCascaderMoreNode,
	filterCascaderLevel,
	findAmbiguousCascaderLabels,
	findCascaderDataIssues,
	flattenCascaderTree,
	getCascaderCheckedValues,
	getCascaderChildren,
	getCascaderCount,
	getCascaderFooterStops,
	getCascaderIndeterminate,
	getCascaderListedValues,
	getCascaderMoreParent,
	getCascaderPath,
	getCascaderSelectedDescendants,
	getCascaderTabTarget,
	isCascaderBranch,
	isCascaderDisabled,
	isCascaderMoreNode,
	isCascaderRtl,
	isCascaderSelectable,
	matchesCascaderQuery,
	mergeCascaderIndex,
	normalizeCascaderQuery,
	searchCascaderDeep,
	withCascaderMoreRow,
} from "./cascader-lib";
import { PRODUCE } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderNode, CascaderNodeBase } from "./cascader-types";

const INDEX = buildCascaderIndex(PRODUCE);

function values(nodes: readonly CascaderNodeBase[]): string[] {
	return nodes.map((node: CascaderNodeBase): string => node.value);
}

interface Flat {
	readonly parent: string | null;
}

const FLAT: readonly CascaderNode<Flat>[] = [
	{ value: "a", label: "A", data: { parent: null } },
	{ value: "b", label: "B", data: { parent: "a" } },
	{ value: "c", label: "C", data: { parent: "b" } },
	{ value: "orphan", label: "Orphan", data: { parent: "missing" } },
];

function flatParent(node: CascaderNode<Flat>): string | null {
	return node.data?.parent ?? null;
}

describe("buildCascaderIndex", (): void => {
	it("indexes a nested tree depth first, with parents and depths", (): void => {
		expect(values(INDEX.roots)).toEqual(["fruit", "veg", "herbs"]);
		expect(values(INDEX.all)).toEqual(["fruit", "apple", "pear", "veg", "carrot", "leafy", "kale", "herbs", "basil"]);
		expect(INDEX.parentOf.get("kale")).toBe("leafy");
		expect(INDEX.depthOf.get("kale")).toBe(2);
		expect(INDEX.byValue.get("apple")?.data?.kcal).toBe(52);
	});

	it("indexes flat adjacency through getParent, an unknown parent making a root", (): void => {
		const index = buildCascaderIndex(FLAT, flatParent);
		expect(values(index.roots)).toEqual(["a", "orphan"]);
		expect(index.depthOf.get("c")).toBe(2);
	});

	it("keeps the first of a duplicate value", (): void => {
		const index = buildCascaderIndex([
			{ value: "x", label: "First" },
			{ value: "x", label: "Second" },
		]);
		expect(index.byValue.get("x")?.label).toBe("First");
		expect(index.all).toHaveLength(1);
	});
});

describe("path finding and node questions", (): void => {
	it("returns the ancestor chain, root first, and empty for an unknown value", (): void => {
		expect(values(getCascaderPath(INDEX, "kale"))).toEqual(["veg", "leafy", "kale"]);
		expect(getCascaderPath(INDEX, "nope")).toEqual([]);
		expect(getCascaderPath(INDEX, null)).toEqual([]);
	});

	it("answers branch, count, children, disabled and selectable", (): void => {
		const leafy = INDEX.byValue.get("leafy");
		const kale = INDEX.byValue.get("kale");
		const basil = INDEX.byValue.get("basil");
		if (leafy === undefined || kale === undefined || basil === undefined) {
			throw new Error("fixture nodes missing");
		}
		expect(isCascaderBranch(INDEX, leafy)).toBe(true);
		expect(isCascaderBranch(INDEX, kale)).toBe(false);
		expect(isCascaderBranch(INDEX, { value: "async", label: "Async", hasChildren: true })).toBe(true);
		expect(getCascaderCount(INDEX, leafy)).toBe(1);
		expect(getCascaderCount(INDEX, { value: "leafy", label: "Leafy", count: 9 })).toBe(9);
		expect(values(getCascaderChildren(INDEX, null))).toEqual(["fruit", "veg", "herbs"]);
		// A disabled branch keeps its whole subtree shut.
		expect(isCascaderDisabled(INDEX, basil)).toBe(true);
		expect(isCascaderSelectable(INDEX, basil, "any")).toBe(false);
		expect(isCascaderSelectable(INDEX, leafy, "leaf")).toBe(false);
		expect(isCascaderSelectable(INDEX, leafy, "any")).toBe(true);
		expect(isCascaderSelectable(INDEX, kale, (node: CascaderNode<{ readonly kcal: number }>): boolean => (node.data?.kcal ?? 0) > 50)).toBe(false);
	});
});

describe("paging rows", (): void => {
	it("creates a paging node that names its level and is never selectable", (): void => {
		const more = createCascaderMoreNode("veg", 2);
		expect(isCascaderMoreNode(more)).toBe(true);
		expect(getCascaderMoreParent(more)).toBe("veg");
		expect(getCascaderMoreParent({ value: "veg", label: "Veg" })).toBeNull();
		expect(isCascaderSelectable(INDEX, more, "any")).toBe(false);
	});

	it("places the paging row before pinned rows", (): void => {
		const rows: readonly CascaderNodeBase[] = [
			{ value: "a", label: "A" },
			{ value: "pinned", label: "P" },
		];
		const more = createCascaderMoreNode(CASCADER_ROOT_KEY);
		expect(values(withCascaderMoreRow(rows, more, new Set(["pinned"])))).toEqual(["a", more.value, "pinned"]);
		expect(values(withCascaderMoreRow(rows, more))).toEqual(["a", "pinned", more.value]);
	});
});

describe("filtering and search", (): void => {
	it("folds case and trims the query", (): void => {
		expect(normalizeCascaderQuery("  ApPle ")).toBe("apple");
		expect(matchesCascaderQuery({ value: "x", label: "Apple" }, "app")).toBe(true);
		expect(matchesCascaderQuery({ value: "x", label: "Apple", keywords: ["pomme"] }, "pom")).toBe(true);
		expect(matchesCascaderQuery({ value: "x", label: "Apple" }, "kiwi")).toBe(false);
	});

	it("filters one level, returning the input itself for an empty query", (): void => {
		const level = getCascaderChildren(INDEX, "fruit");
		expect(filterCascaderLevel(level, "")).toBe(level);
		expect(values(filterCascaderLevel(level, "PEA"))).toEqual(["pear"]);
	});

	it("searches deep, within a branch, and up to a limit", (): void => {
		expect(values(searchCascaderDeep(INDEX, "a"))).toContain("kale");
		expect(values(searchCascaderDeep(INDEX, "a", { within: "veg" }))).toEqual(["carrot", "leafy", "kale"]);
		expect(searchCascaderDeep(INDEX, "a", { limit: 2 })).toHaveLength(2);
		expect(searchCascaderDeep(INDEX, "  ")).toEqual([]);
	});
});

describe("flattening and collapsing", (): void => {
	it("flattens only expanded branches with set metadata", (): void => {
		const rows = flattenCascaderTree(INDEX, new Set(["veg"]));
		expect(values(rows.map((row) => row.node))).toEqual(["fruit", "veg", "carrot", "leafy", "herbs"]);
		const [, vegRow, carrotRow] = rows;
		expect(vegRow).toMatchObject({ branch: true, expanded: true, depth: 0, posInSet: 2, setSize: 3 });
		expect(carrotRow).toMatchObject({ depth: 1, posInSet: 1, setSize: 2 });
	});

	it("counts a sentinel paging row as a sibling", (): void => {
		const rows = flattenCascaderTree(INDEX, new Set(), new Set([CASCADER_ROOT_KEY]));
		expect(rows).toHaveLength(4);
		expect(rows.at(-1)?.setSize).toBe(4);
	});

	it("collapses the middle, the start, or nothing", (): void => {
		const path = getCascaderPath(INDEX, "kale");
		expect(collapseCascaderPath(path, { maxSegments: 2 })).toEqual([
			{ type: "node", node: INDEX.byValue.get("veg") },
			{ type: "ellipsis", hidden: [INDEX.byValue.get("leafy")] },
			{ type: "node", node: INDEX.byValue.get("kale") },
		]);
		expect(collapseCascaderPath(path, { maxSegments: 1, collapse: "start" }).map((segment) => segment.type)).toEqual(["ellipsis", "node"]);
		expect(collapseCascaderPath(path, { collapse: "none" })).toHaveLength(3);
	});
});

describe("merging loaded pages", (): void => {
	it("returns the base itself when nothing loaded", (): void => {
		expect(mergeCascaderIndex(INDEX, new Map())).toBe(INDEX);
	});

	it("folds a page under its level and keeps document order", (): void => {
		const merged = mergeCascaderIndex(INDEX, new Map([["herbs", [{ value: "mint", label: "Mint" }]]]));
		expect(merged.parentOf.get("mint")).toBe("herbs");
		expect(values(merged.all)).toEqual(["fruit", "apple", "pear", "veg", "carrot", "leafy", "kale", "herbs", "basil", "mint"]);
		expect(getCascaderListedValues(merged).has("mint")).toBe(true);
	});

	it("pins, hides or detaches a resolved chain node by its level's paging state", (): void => {
		const chain = new Map<string, CascaderNodeBase>([
			["remote", { value: "remote", label: "Remote" }],
			["deep", { value: "deep", label: "Deep" }],
		]);
		const links = new Map([
			["remote", "fruit"],
			["deep", "remote"],
		]);
		const paging = mergeCascaderIndex(INDEX, new Map(), chain, links, new Set(["fruit"]));
		expect(paging.pinned?.has("remote")).toBe(true);
		expect(isCascaderBranch(paging, { value: "remote", label: "Remote" })).toBe(true);
		const loaded = mergeCascaderIndex(INDEX, new Map(), chain, links, new Set());
		expect(loaded.hidden?.has("remote")).toBe(true);
		expect(values(getCascaderPath(loaded, "deep"))).toEqual(["fruit", "remote", "deep"]);
	});
});

describe("cascade selection", (): void => {
	it("collects the known subtree root first", (): void => {
		expect(values(collectCascaderSubtree(INDEX, "veg"))).toEqual(["veg", "carrot", "leafy", "kale"]);
		expect(collectCascaderSubtree(INDEX, "nope")).toEqual([]);
	});

	it("selects a branch with its subtree and promotes a fully selected parent", (): void => {
		expect(applyCascadeSelection(INDEX, [], "veg", true).sort()).toEqual(["carrot", "kale", "leafy", "veg"]);
		expect(applyCascadeSelection(INDEX, ["carrot"], "kale", true).sort()).toEqual(["carrot", "kale", "leafy", "veg"]);
		expect(applyCascadeSelection(INDEX, ["carrot", "kale", "leafy", "veg"], "kale", false)).toEqual(["carrot"]);
		expect(applyCascadeSelection(INDEX, [], "unknown", true)).toEqual(["unknown"]);
	});

	it("counts selected descendants and reads partial selection off them", (): void => {
		const counts = getCascaderSelectedDescendants(INDEX, ["kale"]);
		expect(counts.get("veg")).toBe(1);
		expect(counts.get("leafy")).toBe(1);
		expect([...getCascaderIndeterminate(INDEX, ["kale"])].sort()).toEqual(["leafy", "veg"]);
	});

	it("condenses a closure by strategy", (): void => {
		const closure = ["veg", "carrot", "leafy", "kale"];
		expect(getCascaderCheckedValues(INDEX, closure, "all")).toBe(closure);
		expect(getCascaderCheckedValues(INDEX, closure, "parent")).toEqual(["veg"]);
		expect(getCascaderCheckedValues(INDEX, closure, "child")).toEqual(["carrot", "kale"]);
	});
});

describe("data checks and labels", (): void => {
	it("finds colliding labels", (): void => {
		expect([
			...findAmbiguousCascaderLabels([
				{ value: "a", label: "Same" },
				{ value: "b", label: "Same" },
				{ value: "c", label: "Other" },
			]),
		]).toEqual(["b", "a"]);
	});

	it("reports duplicates and getParent cycles", (): void => {
		const issues = findCascaderDataIssues<CascaderNode<Flat>>(
			[
				{ value: "x", label: "X", data: { parent: "y" } },
				{ value: "y", label: "Y", data: { parent: "x" } },
				{ value: "x", label: "Again", data: { parent: null } },
			],
			flatParent,
		);
		expect(issues.duplicates).toEqual(["x"]);
		expect(issues.cycles).toEqual(["x", "y", "x"]);
	});
});

describe("DOM helpers", (): void => {
	it("walks the panel's real tab stops and skips the scroll viewport", (): void => {
		document.body.innerHTML =
			'<div data-slot="cascader-panel"><input data-slot="cascader-input" /><div data-slot="scroll-area-viewport" tabindex="0"><button tabindex="-1">row</button></div><div data-slot="cascader-footer"><button>Create</button></div></div>';
		const panel = document.querySelector<HTMLElement>('[data-slot="cascader-panel"]');
		const input = document.querySelector("input");
		if (panel === null || input === null) {
			throw new Error("panel not mounted");
		}
		const [footerStop] = getCascaderFooterStops(panel);
		expect(footerStop?.textContent).toBe("Create");
		expect(getCascaderTabTarget(panel, input, false)).toBe(footerStop);
		expect(getCascaderTabTarget(panel, input, true)).toBeNull();
		document.body.innerHTML = "";
	});

	it("reads the writing direction from the provider or the DOM", (): void => {
		document.body.innerHTML = '<div dir="rtl"><span id="inner"></span></div>';
		const inner = document.getElementById("inner");
		if (inner === null) {
			throw new Error("not mounted");
		}
		expect(isCascaderRtl(inner, "ltr")).toBe(true);
		expect(isCascaderRtl(document.body, "rtl")).toBe(true);
		document.body.innerHTML = "";
	});
});
