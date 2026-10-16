// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	applyFilterExclusiveSelection,
	buildFilterIndex,
	collapseFilterPath,
	computeFilterSchemaSignature,
	createFilterIdFactory,
	filterCombinatorSlot,
	filterFilterLevel,
	filterFilterOptions,
	findFilterSchemaIssues,
	foldFilterText,
	formatFilterPath,
	getCachedFilterIndex,
	getFilterChildren,
	getFilterField,
	getFilterFieldChain,
	getFilterFieldCount,
	isFilterBranch,
	isFilterFieldPickable,
	isFilterFieldSelectable,
	isSameFilterPath,
	joinFilterPath,
	matchesFilterQuery,
	normalizeFilterQuery,
	parentFilterKey,
	FILTER_ROOT_KEY,
	resetFilterWarnings,
	searchFilterDeep,
	splitFilterPath,
	warnFilterOnce,
	type FilterPathSegment,
} from "./filters-lib";
import type { FilterField, FilterIndexEntry, FilterOperator } from "./filters-types";

const FIRST: FilterField = { id: "first", label: "First", keywords: ["given"] };
const LAST: FilterField = { id: "last", label: "Last" };
const NAME: FilterField = { id: "name", label: "Name", fields: [FIRST, LAST] };
const STATUS: FilterField = { id: "status", label: "Status", type: "select", options: [{ value: "open", label: "Open" }] };
const FIELDS: readonly FilterField[] = [STATUS, NAME, { id: "status", label: "Duplicate" }];

const IS: readonly FilterOperator[] = [{ value: "is", label: "is" }];

function labels(segments: readonly FilterPathSegment[]): string[] {
	return segments.map((segment: FilterPathSegment): string => (segment.type === "field" ? segment.field.label : "…"));
}

function isExclusive(value: string): boolean {
	return value === "none";
}

function onlyIs(): readonly FilterOperator[] {
	return IS;
}

afterEach((): void => {
	vi.restoreAllMocks();
	resetFilterWarnings();
});

describe("filters-lib: paths and index", () => {
	it("joins, splits and parents paths", (): void => {
		const key = joinFilterPath(["name", "first"]);
		expect(splitFilterPath(key)).toEqual(["name", "first"]);
		expect(splitFilterPath("")).toEqual([]);
		expect(parentFilterKey(["name"])).toBe(FILTER_ROOT_KEY);
		expect(parentFilterKey(["name", "first"])).toBe(joinFilterPath(["name"]));
		expect(isSameFilterPath(["a", "b"], ["a", "b"])).toBe(true);
		expect(isSameFilterPath(["a"], ["a", "b"])).toBe(false);
	});

	it("indexes a nested schema and drops duplicate sibling ids", (): void => {
		const index = buildFilterIndex(FIELDS);
		expect(index.roots).toEqual([STATUS, NAME]);
		expect(index.all.map((entry: FilterIndexEntry): string => entry.path.join("."))).toEqual(["status", "name", "name.first", "name.last"]);
		expect(getFilterField(index, ["name", "first"])).toBe(FIRST);
		expect(getFilterChildren(index, ["name"])).toEqual([FIRST, LAST]);
		expect(getFilterChildren(index, [])).toEqual([STATUS, NAME]);
		expect(getFilterFieldChain(index, ["name", "last"])).toEqual([NAME, LAST]);
		expect(formatFilterPath(index, ["name", "first"], " > ")).toBe("Name > First");
		expect(formatFilterPath(index, ["gone"], " > ")).toBe("gone");
	});

	it("reuses an index whose signature matches", (): void => {
		const first = buildFilterIndex(FIELDS);
		expect(buildFilterIndex([...FIELDS], first)).toBe(first);
		expect(getCachedFilterIndex([...FIELDS])).toBe(getCachedFilterIndex([...FIELDS]));
		expect(computeFilterSchemaSignature([STATUS])).not.toBe(computeFilterSchemaSignature([{ ...STATUS, options: [{ value: "open", label: "Open", exclusive: true }] }]));
	});

	it("tells branches, selectable and pickable fields apart", (): void => {
		expect(isFilterBranch(NAME)).toBe(true);
		expect(isFilterFieldSelectable(NAME)).toBe(false);
		expect(isFilterFieldSelectable({ ...NAME, selectable: true })).toBe(true);
		expect(isFilterFieldPickable({ ...NAME, selectable: true })).toBe(false);
		expect(isFilterFieldPickable({ ...LAST, disabled: true })).toBe(false);
		expect(getFilterFieldCount(NAME)).toBe(2);
		expect(getFilterFieldCount({ ...NAME, count: 9 })).toBe(9);
	});

	it("collapses a long path", (): void => {
		const chain: readonly FilterField[] = [NAME, FIRST, LAST, STATUS];
		expect(labels(collapseFilterPath(chain))).toEqual(["Name", "First", "Last", "Status"]);
		expect(labels(collapseFilterPath(chain, { collapse: "middle", maxSegments: 3 }))).toEqual(["Name", "…", "Last", "Status"]);
		expect(labels(collapseFilterPath(chain, { collapse: "start", maxSegments: 2 }))).toEqual(["…", "Last", "Status"]);
		expect(labels(collapseFilterPath(chain.slice(0, 2), { collapse: "middle", maxSegments: 3 }))).toEqual(["Name", "First"]);
	});
});

describe("filters-lib: matching, slots, exclusive and ids", () => {
	it("matches by label and keywords, folding case", (): void => {
		expect(foldFilterText("ÉCOLE")).toBe("école");
		expect(normalizeFilterQuery("  Fir ")).toBe("fir");
		expect(matchesFilterQuery(FIRST, "given")).toBe(true);
		expect(filterFilterLevel([FIRST, LAST], "las")).toEqual([LAST]);
		expect(filterFilterOptions([{ value: "a", label: "Alpha", keywords: ["first"] }], "fir")).toHaveLength(1);
		const index = buildFilterIndex(FIELDS);
		expect(searchFilterDeep(index, "first").map((entry: FilterIndexEntry): string => entry.path.join("."))).toEqual(["name.first"]);
		expect(searchFilterDeep(index, "")).toEqual([]);
		expect(searchFilterDeep(index, "a", 1)).toHaveLength(1);
	});

	it("names the three combinator slots", (): void => {
		expect([0, 1, 2, 3].map(filterCombinatorSlot)).toEqual(["where", "toggle", "echo", "echo"]);
	});

	it("applies the None rule against the delta", (): void => {
		const previous = ["a"];
		const unchanged = ["a", "b"];
		expect(applyFilterExclusiveSelection(unchanged, previous, isExclusive)).toBe(unchanged);
		expect(applyFilterExclusiveSelection(["a", "none"], previous, isExclusive)).toEqual(["none"]);
		expect(applyFilterExclusiveSelection(["none", "b"], ["none"], isExclusive)).toEqual(["b"]);
		expect(applyFilterExclusiveSelection([], ["none"], isExclusive)).toEqual([]);
	});

	it("mints deterministic ids", (): void => {
		const next = createFilterIdFactory("s");
		expect([next(), next()]).toEqual(["s1", "s2"]);
	});

	it("warns once per key and reports schema issues", (): void => {
		const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
		warnFilterOnce("k", "careful");
		warnFilterOnce("k", "careful");
		expect(warn).toHaveBeenCalledTimes(1);
		const issues = findFilterSchemaIssues(
			[{ id: "", label: "" }, STATUS, STATUS, { id: "b", label: "B", selectable: true, fields: [] }, { id: "d", label: "D", defaultOperator: "x" }],
			onlyIs,
		);
		expect(issues).toEqual({ duplicatePaths: ["status"], emptyIds: [""], emptyBranches: ["b"], unknownDefaultOperators: ["d -> x"] });
	});
});
