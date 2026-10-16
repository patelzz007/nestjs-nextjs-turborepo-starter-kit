// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	clearFilterQuery,
	collectFilterIssues,
	compareFilterBounds,
	copyFilterNodeTo,
	countFilterRules,
	createFilterGroup,
	createFilterQuery,
	createFilterRule,
	duplicateFilterNode,
	findFilterNode,
	findFilterRule,
	flattenFilterConditions,
	flattenFilterRules,
	hasUniqueFilterIds,
	insertFilterNode,
	isFilterQueryEmpty,
	isFilterRuleComplete,
	moveFilterNode,
	moveFilterNodeTo,
	parseFilterQuery,
	pruneFilterQuery,
	removeFilterNode,
	reorderFilterNodes,
	serializeFilterQuery,
	setFilterCombinator,
	toggleFilterCombinator,
	unwrapFilterGroup,
	updateFilterRule,
	wrapFilterNodeInGroup,
} from "./filters-query";
import { FILTER_LIMITS, type FilterGroupNode, type FilterNode, type FilterOperatorArity, type FilterQuery, type FilterRule } from "./filters-types";

const STATUS = createFilterRule({ id: "r1", path: ["status"], operator: "is", value: "open" });
const NAME = createFilterRule({ id: "r2", path: ["name", "first"], operator: "contains", value: "ann" });
const AGE = createFilterRule({ id: "r3", path: ["age"], operator: "between", value: [10, 20] });
const NESTED = createFilterGroup({ id: "g1", combinator: "or", rules: [NAME, AGE] });
const QUERY = createFilterQuery([STATUS, NESTED]);

function idFactory(): () => string {
	let next = 0;
	return (): string => {
		next += 1;
		return `n${String(next)}`;
	};
}

function ids(nodes: readonly FilterNode[]): string[] {
	return nodes.map((node: FilterNode): string => node.id);
}

function groupAt(query: FilterQuery, id: string): FilterGroupNode {
	const found = findFilterNode(query, id)?.node;
	if (found?.type !== "group") {
		throw new Error(`no group ${id}`);
	}
	return found;
}

function arityOneOrRange(rule: FilterRule): FilterOperatorArity | null {
	if (rule.path.join(".") === "unknown") {
		return null;
	}
	return rule.operator === "between" ? "range" : rule.operator === "empty" ? "none" : "one";
}

describe("filters-query: construction and reading", () => {
	it("creates rules, groups and an empty root", (): void => {
		expect(createFilterQuery()).toEqual({ id: "root", type: "group", combinator: "and", rules: [] });
		expect(createFilterRule({ id: "x", path: ["a"], operator: "is", negated: true })).toEqual({ id: "x", type: "rule", path: ["a"], operator: "is", negated: true });
		expect(createFilterGroup({ id: "g" })).toEqual({ id: "g", type: "group", combinator: "and", rules: [] });
	});

	it("flattens rules depth first and counts them", (): void => {
		expect(ids(flattenFilterRules(QUERY))).toEqual(["r1", "r2", "r3"]);
		expect(countFilterRules(QUERY)).toBe(3);
		expect(isFilterQueryEmpty(createFilterQuery())).toBe(true);
		expect(isFilterQueryEmpty(QUERY)).toBe(false);
	});

	it("flattens complete rules to conditions with list values", (): void => {
		const incomplete = createFilterRule({ id: "r9", path: ["x"], operator: "" });
		const conditions = flattenFilterConditions(createFilterQuery([STATUS, AGE, incomplete]));
		expect(conditions).toEqual([
			{ path: ["status"], field: "status", operator: "is", values: ["open"], negated: false },
			{ path: ["age"], field: "age", operator: "between", values: [10, 20], negated: false },
		]);
		expect(isFilterRuleComplete(incomplete)).toBe(false);
	});

	it("finds nodes and rules by id", (): void => {
		expect(findFilterNode(QUERY, "root")?.parent).toBeNull();
		expect(findFilterNode(QUERY, "r3")?.parent?.id).toBe("g1");
		expect(findFilterNode(QUERY, "r3")?.index).toBe(1);
		expect(findFilterRule(QUERY, "g1")).toBeNull();
		expect(findFilterRule(QUERY, "r2")).toBe(NAME);
		expect(findFilterNode(QUERY, "missing")).toBeNull();
	});
});

describe("filters-query: issues", () => {
	it("reports every way a query cannot run", (): void => {
		const query = createFilterQuery([
			createFilterRule({ id: "a", path: ["x"], operator: "" }),
			createFilterRule({ id: "b", path: ["x"], operator: "is" }),
			createFilterRule({ id: "c", path: ["x"], operator: "between", value: [1, null] }),
			createFilterRule({ id: "d", path: ["x"], operator: "between", value: [9, 1] }),
			createFilterGroup({ id: "g" }),
			createFilterRule({ id: "e", path: ["x"], operator: "empty" }),
			createFilterRule({ id: "f", path: ["unknown"], operator: "" }),
		]);
		const issues = collectFilterIssues(query, arityOneOrRange);
		expect(issues.map((issue): string => `${issue.nodeId}:${issue.reason}`)).toEqual([
			"a:missing-operator",
			"b:missing-value",
			"c:incomplete-range",
			"d:reversed-range",
			"g:empty-group",
		]);
	});

	it("runs a custom validator only on rules the built-ins accept", (): void => {
		const query = createFilterQuery([STATUS, createFilterRule({ id: "b", path: ["x"], operator: "is" })]);
		const issues = collectFilterIssues(query, arityOneOrRange, (): string => "Too short");
		expect(issues).toEqual([
			{ nodeId: "r1", column: "value", reason: "custom", message: "Too short" },
			{ nodeId: "b", column: "value", reason: "missing-value" },
		]);
	});

	it("compares numeric and date bounds, and gives up on words", (): void => {
		expect(compareFilterBounds(1, 2)).toBeLessThan(0);
		expect(compareFilterBounds("2024-02-01", "2024-01-01")).toBeGreaterThan(0);
		expect(compareFilterBounds({ date: "2024-01-01" }, { date: "2024-01-02" })).toBeLessThan(0);
		expect(compareFilterBounds("red", "blue")).toBeNull();
		expect(compareFilterBounds({ relative: { unit: "day", offset: 1 } }, 3)).toBeNull();
	});
});

describe("filters-query: edits", () => {
	it("updates a rule, keeping untouched subtrees by identity", (): void => {
		const next = updateFilterRule(QUERY, "r2", { value: "bob" });
		expect(findFilterRule(next, "r2")?.value).toBe("bob");
		expect(next.rules[LIST_SLOT_INDEX.first]).toBe(STATUS);
		expect(updateFilterRule(QUERY, "missing", { value: "x" })).toBe(QUERY);
	});

	it("clears a value or a negation when the update sets it to undefined", (): void => {
		const negated = updateFilterRule(QUERY, "r1", { negated: true });
		expect(findFilterRule(negated, "r1")?.negated).toBe(true);
		const cleared = updateFilterRule(negated, "r1", { value: undefined, negated: undefined });
		expect(findFilterRule(cleared, "r1")).toEqual({ id: "r1", type: "rule", path: ["status"], operator: "is" });
	});

	it("removes a node and prunes the groups it empties", (): void => {
		const once = removeFilterNode(QUERY, "r2");
		expect(ids(groupAt(once, "g1").rules)).toEqual(["r3"]);
		const twice = removeFilterNode(once, "r3");
		expect(ids(twice.rules)).toEqual(["r1"]);
		expect(removeFilterNode(QUERY, "missing")).toBe(QUERY);
	});

	it("inserts at an index, clamped, into the root or a group", (): void => {
		const rule = createFilterRule({ id: "new", path: ["x"], operator: "is" });
		expect(ids(insertFilterNode(QUERY, rule).rules)).toEqual(["r1", "g1", "new"]);
		expect(ids(insertFilterNode(QUERY, rule, "root", 0).rules)).toEqual(["new", "r1", "g1"]);
		expect(ids(groupAt(insertFilterNode(QUERY, rule, "g1", 99), "g1").rules)).toEqual(["r2", "r3", "new"]);
	});

	it("duplicates a node under fresh ids, deeply", (): void => {
		const next = duplicateFilterNode(QUERY, "g1", idFactory());
		const copy = next.rules[LIST_SLOT_INDEX.third];
		expect(copy?.type).toBe("group");
		expect(hasUniqueFilterIds(next)).toBe(true);
		expect(countFilterRules(next)).toBe(5);
		expect(duplicateFilterNode(QUERY, "root", idFactory())).toBe(QUERY);
	});

	it("sets and toggles a group's combinator", (): void => {
		expect(setFilterCombinator(QUERY, "g1", "or")).toBe(QUERY);
		expect(groupAt(setFilterCombinator(QUERY, "g1", "and"), "g1").combinator).toBe("and");
		expect(toggleFilterCombinator(QUERY, "root").combinator).toBe("or");
		expect(toggleFilterCombinator(QUERY, "r1")).toBe(QUERY);
	});

	it("moves within a group and ignores out-of-range moves", (): void => {
		expect(ids(moveFilterNode(QUERY, "r1", 1).rules)).toEqual(["g1", "r1"]);
		expect(moveFilterNode(QUERY, "r1", -1)).toBe(QUERY);
		expect(moveFilterNode(QUERY, "r1", 0)).toBe(QUERY);
	});

	it("reorders a list purely", (): void => {
		const list = ["a", "b", "c"];
		expect(reorderFilterNodes(list, 0, 2)).toEqual(["b", "c", "a"]);
		expect(reorderFilterNodes(list, 2, 0)).toEqual(["c", "a", "b"]);
		expect(reorderFilterNodes(list, 1, 1)).toBe(list);
		expect(reorderFilterNodes(list, 0, 5)).toBe(list);
	});

	it("moves across groups and refuses cycles and self-slots", (): void => {
		const into = moveFilterNodeTo(QUERY, "r1", "g1", 0);
		expect(ids(into.rules)).toEqual(["g1"]);
		expect(ids(groupAt(into, "g1").rules)).toEqual(["r1", "r2", "r3"]);
		expect(moveFilterNodeTo(QUERY, "g1", "g1", 0)).toBe(QUERY);
		expect(moveFilterNodeTo(QUERY, "r2", "g1", 1)).toBe(QUERY);
		expect(ids(groupAt(moveFilterNodeTo(QUERY, "r2", "g1", 2), "g1").rules)).toEqual(["r3", "r2"]);
	});

	it("copies a node into a group", (): void => {
		const next = copyFilterNodeTo(QUERY, "r1", "g1", 0, idFactory());
		expect(ids(groupAt(next, "g1").rules)).toEqual(["n1", "r2", "r3"]);
		expect(copyFilterNodeTo(QUERY, "r1", "r2", 0, idFactory())).toBe(QUERY);
	});

	it("wraps and unwraps, round-tripping", (): void => {
		const wrapped = wrapFilterNodeInGroup(QUERY, "r1", "w1");
		expect(groupAt(wrapped, "w1").combinator).toBe("or");
		expect(ids(groupAt(wrapped, "w1").rules)).toEqual(["r1"]);
		expect(unwrapFilterGroup(wrapped, "w1")).toEqual(QUERY);
		expect(unwrapFilterGroup(QUERY, "root")).toBe(QUERY);
		expect(unwrapFilterGroup(QUERY, "r1")).toBe(QUERY);
	});

	it("clears and prunes", (): void => {
		expect(clearFilterQuery(QUERY).rules).toEqual([]);
		const empty = createFilterQuery();
		expect(clearFilterQuery(empty)).toBe(empty);
		const messy = createFilterQuery([createFilterGroup({ id: "e" }), createFilterGroup({ id: "outer", rules: [createFilterGroup({ id: "inner", rules: [STATUS] })] })]);
		expect(pruneFilterQuery(messy)).toEqual(createFilterQuery([createFilterGroup({ id: "inner", rules: [STATUS] })]));
	});
});

describe("filters-query: serialization", () => {
	it("round-trips a query through a string", (): void => {
		const withDate = insertFilterNode(QUERY, createFilterRule({ id: "d", path: ["created"], operator: "is_after", value: { relative: { unit: "week", offset: -1 } } }));
		const parsed = parseFilterQuery(serializeFilterQuery(withDate));
		expect(parsed.success).toBe(true);
		expect(parsed.success ? parsed.query : null).toEqual(withDate);
	});

	it("refuses broken JSON, a bad shape, duplicate ids and an over-deep tree", (): void => {
		const broken = parseFilterQuery("{not json");
		expect(broken.success ? null : broken.error.reason).toBe("invalid-json");
		const shape = parseFilterQuery(JSON.stringify({ id: "root", type: "group", combinator: "xor", rules: [] }));
		expect(shape.success ? null : shape.error.reason).toBe("invalid-shape");
		const extra = parseFilterQuery(JSON.stringify({ ...STATUS, sql: "DROP TABLE" }));
		expect(extra.success).toBe(false);
		const duplicate = parseFilterQuery(serializeFilterQuery(createFilterQuery([STATUS, STATUS])));
		expect(duplicate.success ? null : duplicate.error.reason).toBe("duplicate-id");
		let deep: FilterGroupNode = createFilterGroup({ id: "leaf", rules: [STATUS] });
		for (let level = 0; level <= FILTER_LIMITS.maxDepth; level += 1) {
			deep = createFilterGroup({ id: `g${String(level)}`, rules: [deep] });
		}
		expect(parseFilterQuery(serializeFilterQuery(deep)).success).toBe(false);
	});

	it("bounds string values", (): void => {
		const long = createFilterRule({ id: "x", path: ["a"], operator: "is", value: "a".repeat(FILTER_LIMITS.maxTextLength + 1) });
		expect(parseFilterQuery(serializeFilterQuery(createFilterQuery([long]))).success).toBe(false);
	});
});
