import { isNumberPrimitive, isStringPrimitive } from "@workspace/shared";

import {
	FilterQuerySchema,
	filterValueItems,
	isFilterDateValue,
	type FilterCombinator,
	type FilterGroupNode,
	type FilterIssue,
	type FilterNode,
	type FilterOperatorArity,
	type FilterQuery,
	type FilterRule,
	type FilterValue,
	type FilterValueItem,
} from "./filters-types";

export function isFilterRule(node: FilterNode): node is FilterRule {
	return node.type === "rule";
}

export function isFilterGroup(node: FilterNode): node is FilterGroupNode {
	return node.type === "group";
}

/** The id of the root group `createFilterQuery` mints when the caller names none. */
export const FILTER_ROOT_ID = "root";

export interface CreateFilterRuleInput {
	readonly id: string;
	readonly path: readonly string[];
	readonly operator: string;
	readonly value?: FilterValue | undefined;
	readonly negated?: boolean | undefined;
}

/**
 * A rule. `id` is passed in, never generated here: a non-deterministic value in
 * a pure function breaks hydration. Callers use `createFilterIdFactory`.
 */
export function createFilterRule(input: CreateFilterRuleInput): FilterRule {
	const base: FilterRule = { id: input.id, type: "rule", path: input.path, operator: input.operator };
	const withValue = input.value === undefined ? base : { ...base, value: input.value };
	return input.negated === true ? { ...withValue, negated: true } : withValue;
}

export interface CreateFilterGroupInput {
	readonly id: string;
	readonly combinator?: FilterCombinator | undefined;
	readonly rules?: readonly FilterNode[] | undefined;
}

export function createFilterGroup(input: CreateFilterGroupInput): FilterGroupNode {
	return { id: input.id, type: "group", combinator: input.combinator ?? "and", rules: input.rules ?? [] };
}

/** An empty query. The root is always a group, never a bare list. */
export function createFilterQuery(rules: readonly FilterNode[] = [], combinator: FilterCombinator = "and", id: string = FILTER_ROOT_ID): FilterQuery {
	return { id, type: "group", combinator, rules };
}

/** Every rule in the tree, depth first. Groups are flattened away. */
export function flattenFilterRules(query: FilterQuery): FilterRule[] {
	const out: FilterRule[] = [];
	const walk = (node: FilterNode): void => {
		if (isFilterRule(node)) {
			out.push(node);
			return;
		}
		for (const child of node.rules) {
			walk(child);
		}
	};
	walk(query);
	return out;
}

/**
 * One rule, flattened for a predicate. `values` is always a list even though
 * `FilterRule.value` is singular, so no caller re-derives arity.
 */
export interface FilterCondition {
	/** Full field path, `["name", "first"]`. */
	readonly path: readonly string[];
	/** First path segment, for the common flat-schema case. */
	readonly field: string;
	readonly operator: string;
	/** `[]` for an operator that takes no value. */
	readonly values: readonly FilterValueItem[];
	readonly negated: boolean;
}

/**
 * Whether a rule says anything yet. A rule exists as soon as an attribute is
 * picked, so `operator: ""` is a real state.
 */
export function isFilterRuleComplete(rule: FilterRule): boolean {
	return rule.operator !== "";
}

/**
 * Flattens a query to conditions. Lossy: safe only when the query is flat or
 * every group shares the root's combinator. Incomplete rules are left out.
 */
export function flattenFilterConditions(query: FilterQuery): FilterCondition[] {
	return flattenFilterRules(query)
		.filter(isFilterRuleComplete)
		.map((rule: FilterRule): FilterCondition => ({
			path: rule.path,
			field: rule.path.at(0) ?? "",
			operator: rule.operator,
			values: filterValueItems(rule.value),
			negated: rule.negated === true,
		}));
}

/** How many rules the query holds, at any depth. */
export function countFilterRules(query: FilterQuery): number {
	return flattenFilterRules(query).length;
}

/** Whether the query would match everything. */
export function isFilterQueryEmpty(query: FilterQuery): boolean {
	return countFilterRules(query) === 0;
}

/**
 * How an arity is answered for one rule. The caller resolves it, since arity
 * lives on the FIELD's operator list. `null` is a rule it cannot judge.
 */
export type FilterArityResolver = (rule: FilterRule) => FilterOperatorArity | null;

/** Runs a field's own `validate`. */
export type FilterValidateResolver = (rule: FilterRule) => string | null | undefined;

/** A value slot the user has not filled in. `false` and `0` are values. */
function isBlankFilterValue(value: FilterValueItem | undefined): boolean {
	return value === undefined || value === null || value === "";
}

function boundTime(bound: FilterValueItem): number | null {
	if (isFilterDateValue(bound)) {
		if (bound.date === undefined) {
			return null;
		}
		const time = Date.parse(bound.date);
		return Number.isNaN(time) ? null : time;
	}
	if (isStringPrimitive(bound)) {
		const time = Date.parse(bound);
		return Number.isNaN(time) ? null : time;
	}
	return null;
}

/**
 * Compares two range bounds, or gives up. Numbers, absolute dates and ISO
 * strings only: inventing an order for colour names would flag a correct
 * filter as reversed.
 */
export function compareFilterBounds(from: FilterValueItem, to: FilterValueItem): number | null {
	if (isNumberPrimitive(from) && isNumberPrimitive(to)) {
		return Number.isNaN(from) || Number.isNaN(to) ? null : from - to;
	}
	const fromTime = boundTime(from);
	const toTime = boundTime(to);
	return fromTime === null || toTime === null ? null : fromTime - toTime;
}

function ruleIssue(rule: FilterRule, arity: FilterOperatorArity, validateOf: FilterValidateResolver | undefined): FilterIssue | null {
	if (!isFilterRuleComplete(rule)) {
		return { nodeId: rule.id, column: "operator", reason: "missing-operator" };
	}
	if (arity === "none") {
		return null;
	}
	const values = filterValueItems(rule.value);
	if (arity === "range") {
		const [from, to] = values;
		if (from === undefined || to === undefined || isBlankFilterValue(from) || isBlankFilterValue(to)) {
			return { nodeId: rule.id, column: "value", reason: "incomplete-range" };
		}
		const order = compareFilterBounds(from, to);
		return order !== null && order > 0 ? { nodeId: rule.id, column: "value", reason: "reversed-range" } : null;
	}
	// `many` and `one` collapse here: both are unsatisfied by an empty list.
	if (values.length === 0 || values.every(isBlankFilterValue)) {
		return { nodeId: rule.id, column: "value", reason: "missing-value" };
	}
	// LAST, and only on a rule the primitive is already happy with.
	const message = validateOf?.(rule);
	return message === undefined || message === null || message === "" ? null : { nodeId: rule.id, column: "value", reason: "custom", message };
}

/**
 * Every reason a query cannot be run as written, in document order. A group of
 * exactly ONE node is NOT an issue, and the root is exempt from `empty-group`.
 */
export function collectFilterIssues(query: FilterQuery, arityOf: FilterArityResolver, validateOf?: FilterValidateResolver): FilterIssue[] {
	const issues: FilterIssue[] = [];
	const visit = (group: FilterGroupNode, isRoot: boolean): void => {
		if (!isRoot && group.rules.length === 0) {
			issues.push({ nodeId: group.id, column: "group", reason: "empty-group" });
		}
		for (const child of group.rules) {
			if (isFilterGroup(child)) {
				visit(child, false);
				continue;
			}
			// Asked FIRST: `null` means the caller cannot judge this rule at all.
			const arity = arityOf(child);
			if (arity === null) {
				continue;
			}
			const issue = ruleIssue(child, arity, validateOf);
			if (issue !== null) {
				issues.push(issue);
			}
		}
	};
	visit(query, true);
	return issues;
}

export interface FilterNodeLocation {
	readonly node: FilterNode;
	readonly parent: FilterGroupNode | null;
	readonly index: number;
}

interface FilterChildLocation {
	readonly node: FilterNode;
	readonly parent: FilterGroupNode;
	readonly index: number;
}

/** Locates a node and its parent. Returns null when the id is unknown. */
export function findFilterNode(query: FilterQuery, id: string): FilterNodeLocation | null {
	if (query.id === id) {
		return { node: query, parent: null, index: -1 };
	}
	const walk = (group: FilterGroupNode): FilterChildLocation | null => {
		for (const [index, child] of group.rules.entries()) {
			if (child.id === id) {
				return { node: child, parent: group, index };
			}
			if (isFilterGroup(child)) {
				const found = walk(child);
				if (found !== null) {
					return found;
				}
			}
		}
		return null;
	};
	return walk(query);
}

function findChildLocation(query: FilterQuery, id: string): FilterChildLocation | null {
	const found = findFilterNode(query, id);
	if (found?.parent == null) {
		return null;
	}
	return { node: found.node, parent: found.parent, index: found.index };
}

/** The rule with this id, or null when the id names a group or is unknown. */
export function findFilterRule(query: FilterQuery, id: string): FilterRule | null {
	const found = findFilterNode(query, id);
	if (found === null || !isFilterRule(found.node)) {
		return null;
	}
	return found.node;
}

/**
 * Rebuilds the tree, applying `transform` to the group that `shouldRewrite`
 * picks. An unchanged subtree comes back BY IDENTITY, so `React.memo` holds
 * for all but the changed rows.
 */
function rewriteGroup(group: FilterGroupNode, shouldRewrite: (group: FilterGroupNode) => boolean, transform: (group: FilterGroupNode) => FilterGroupNode): FilterGroupNode {
	if (shouldRewrite(group)) {
		return transform(group);
	}
	const rules = group.rules.map((child: FilterNode): FilterNode => (isFilterGroup(child) ? rewriteGroup(child, shouldRewrite, transform) : child));
	const changed = rules.some((child: FilterNode, index: number): boolean => child !== group.rules[index]);
	return changed ? { ...group, rules } : group;
}

export type FilterRuleUpdates = Partial<Omit<FilterRule, "id" | "type">>;

/** Replaces a rule's fields. Unknown ids return the query unchanged. */
export function updateFilterRule(query: FilterQuery, id: string, updates: FilterRuleUpdates): FilterQuery {
	const isTarget = (child: FilterNode): boolean => child.id === id && isFilterRule(child);
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.rules.some(isTarget),
		(group: FilterGroupNode): FilterGroupNode => ({
			...group,
			rules: group.rules.map((child: FilterNode): FilterNode => (isFilterRule(child) && child.id === id ? applyRuleUpdates(child, updates) : child)),
		}),
	);
}

/** A rule with `updates` laid over it; an `undefined` in `updates` CLEARS that field. */
function applyRuleUpdates(rule: FilterRule, updates: FilterRuleUpdates): FilterRule {
	const merged = { ...rule, ...updates };
	const { value, negated, ...rest } = merged;
	const withValue = value === undefined ? rest : { ...rest, value };
	return negated === undefined || !negated ? withValue : { ...withValue, negated };
}

/**
 * Removes a node, plus any group it empties, all the way up (not the root): an
 * empty group is invisible in the flat UI yet still compiles to parentheses.
 */
export function removeFilterNode(query: FilterQuery, id: string): FilterQuery {
	const prune = (group: FilterGroupNode): FilterGroupNode => {
		let changed = false;
		const rules: FilterNode[] = [];
		for (const child of group.rules) {
			if (child.id === id) {
				changed = true;
				continue;
			}
			if (isFilterGroup(child)) {
				const next = prune(child);
				if (next !== child) {
					changed = true;
					if (next.rules.length === 0) {
						continue;
					}
				}
				rules.push(next);
				continue;
			}
			rules.push(child);
		}
		return changed ? { ...group, rules } : group;
	};
	return prune(query);
}

/** Inserts a node into a group (default: the root), at `index` or the end. */
export function insertFilterNode(query: FilterQuery, node: FilterNode, parentId?: string, index?: number): FilterQuery {
	const targetId = parentId ?? query.id;
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.id === targetId,
		(group: FilterGroupNode): FilterGroupNode => {
			const rules = [...group.rules];
			const at = index === undefined ? rules.length : Math.max(0, Math.min(index, rules.length));
			rules.splice(at, 0, node);
			return { ...group, rules };
		},
	);
}

/** A deep copy under fresh ids, the whole way down. */
function cloneFilterNode(node: FilterNode, nextId: () => string): FilterNode {
	if (isFilterRule(node)) {
		return { ...node, id: nextId() };
	}
	return { ...node, id: nextId(), rules: node.rules.map((child: FilterNode): FilterNode => cloneFilterNode(child, nextId)) };
}

/** Copies a node in beside the original. */
export function duplicateFilterNode(query: FilterQuery, id: string, nextId: () => string): FilterQuery {
	const found = findChildLocation(query, id);
	if (found === null) {
		return query;
	}
	return insertFilterNode(query, cloneFilterNode(found.node, nextId), found.parent.id, found.index + 1);
}

export function setFilterCombinator(query: FilterQuery, groupId: string, combinator: FilterCombinator): FilterQuery {
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.id === groupId,
		(group: FilterGroupNode): FilterGroupNode => (group.combinator === combinator ? group : { ...group, combinator }),
	);
}

export function toggleFilterCombinator(query: FilterQuery, groupId: string): FilterQuery {
	const found = findFilterNode(query, groupId);
	if (found === null || !isFilterGroup(found.node)) {
		return query;
	}
	return setFilterCombinator(query, groupId, found.node.combinator === "and" ? "or" : "and");
}

/** Moves a node within its own group by `delta`. Out of range moves are no-ops. */
export function moveFilterNode(query: FilterQuery, id: string, delta: number): FilterQuery {
	const found = findChildLocation(query, id);
	if (found === null) {
		return query;
	}
	const from = found.index;
	const to = from + delta;
	const parentId = found.parent.id;
	if (delta === 0 || to < 0 || to >= found.parent.rules.length) {
		return query;
	}
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.id === parentId,
		(group: FilterGroupNode): FilterGroupNode => ({ ...group, rules: reorderFilterNodes(group.rules, from, to) }),
	);
}

/** A list with the item at `from` moved to `to`. Pure, and the same list for a no-op. */
export function reorderFilterNodes<T>(items: readonly T[], from: number, to: number): readonly T[] {
	if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
		return items;
	}
	const next = [...items];
	const [moved] = next.splice(from, 1);
	if (moved === undefined) {
		return items;
	}
	next.splice(to, 0, moved);
	return next;
}

/** Whether `id` names `node` itself or anything beneath it. */
function containsFilterNode(node: FilterNode, id: string): boolean {
	if (node.id === id) {
		return true;
	}
	if (isFilterRule(node)) {
		return false;
	}
	return node.rules.some((child: FilterNode): boolean => containsFilterNode(child, id));
}

/**
 * Removes a node WITHOUT pruning what it empties. A move cannot reuse
 * `removeFilterNode`: it would delete the group the drop is aimed at.
 */
function detachFilterNode(group: FilterGroupNode, id: string): FilterGroupNode {
	let changed = false;
	const rules: FilterNode[] = [];
	for (const child of group.rules) {
		if (child.id === id) {
			changed = true;
			continue;
		}
		if (isFilterGroup(child)) {
			const next = detachFilterNode(child, id);
			if (next !== child) {
				changed = true;
			}
			rules.push(next);
			continue;
		}
		rules.push(child);
	}
	return changed ? { ...group, rules } : group;
}

/**
 * Moves a node into another group, at an index. Refuses a group into itself or
 * a descendant, which would leave a cycle, and refuses the root.
 */
export function moveFilterNodeTo(query: FilterQuery, id: string, parentId: string, index: number): FilterQuery {
	const found = findChildLocation(query, id);
	if (found === null || containsFilterNode(found.node, parentId)) {
		return query;
	}
	const destination = findFilterNode(query, parentId);
	if (destination === null || !isFilterGroup(destination.node)) {
		return query;
	}
	// Within one parent the node's own slot disappears when it detaches, so
	// indexes after it shift down by one.
	const sameParent = found.parent.id === parentId;
	const target = sameParent && found.index < index ? index - 1 : index;
	if (sameParent && target === found.index) {
		return query;
	}
	return insertFilterNode(detachFilterNode(query, id), found.node, parentId, target);
}

/**
 * Copies a node into a group at a position: the Alt path of the drag layer. The
 * clone is taken BEFORE the insert, so copying a group into itself stays finite.
 */
export function copyFilterNodeTo(query: FilterQuery, id: string, parentId: string, index: number, nextId: () => string): FilterQuery {
	const found = findChildLocation(query, id);
	if (found === null) {
		return query;
	}
	const destination = findFilterNode(query, parentId);
	if (destination === null || !isFilterGroup(destination.node)) {
		return query;
	}
	return insertFilterNode(query, cloneFilterNode(found.node, nextId), parentId, index);
}

/**
 * Wraps a node in a new group: the "Wrap in group" action, and the keyboard
 * path to nesting for a user who cannot drag.
 */
export function wrapFilterNodeInGroup(query: FilterQuery, id: string, groupId: string, combinator: FilterCombinator = "or"): FilterQuery {
	const found = findChildLocation(query, id);
	if (found === null) {
		return query;
	}
	const parentId = found.parent.id;
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.id === parentId,
		(group: FilterGroupNode): FilterGroupNode => ({
			...group,
			rules: group.rules.map((child: FilterNode): FilterNode => (child.id === id ? createFilterGroup({ id: groupId, combinator, rules: [child] }) : child)),
		}),
	);
}

/**
 * Dissolves a group into its parent, splicing its rules in at the position the
 * group held so wrap and unwrap round-trip.
 */
export function unwrapFilterGroup(query: FilterQuery, groupId: string): FilterQuery {
	const found = findChildLocation(query, groupId);
	if (found === null || !isFilterGroup(found.node)) {
		return query;
	}
	const dissolved = found.node;
	const parentId = found.parent.id;
	return rewriteGroup(
		query,
		(group: FilterGroupNode): boolean => group.id === parentId,
		(group: FilterGroupNode): FilterGroupNode => {
			const rules = [...group.rules];
			rules.splice(found.index, 1, ...dissolved.rules);
			return { ...group, rules };
		},
	);
}

/** Empties the query, keeping the root's identity fields. */
export function clearFilterQuery(query: FilterQuery): FilterQuery {
	return query.rules.length === 0 ? query : { ...query, rules: [] };
}

/**
 * Drops empty groups and collapses a group whose only child is a group. Not
 * automatic: a user mid-edit may hold an almost-empty group. Call on persist.
 */
export function pruneFilterQuery(query: FilterQuery): FilterQuery {
	const prune = (node: FilterNode): FilterNode | null => {
		if (isFilterRule(node)) {
			return node;
		}
		const rules = node.rules.map(prune).filter((child: FilterNode | null): child is FilterNode => child !== null);
		if (rules.length === 0) {
			return null;
		}
		const [only] = rules;
		if (rules.length === 1 && only !== undefined && isFilterGroup(only)) {
			return only;
		}
		return { ...node, rules };
	};
	const rules = query.rules.map(prune).filter((child: FilterNode | null): child is FilterNode => child !== null);
	return { ...query, rules };
}

/* -------------------------------------------------------------------------- */
/*                                Serialization                               */
/* -------------------------------------------------------------------------- */

/** Why a serialized query was refused. */
export type FilterQueryParseFailure = "invalid-json" | "invalid-shape" | "duplicate-id";

/** A serialized query that could not be trusted. Typed, so a caller can branch on `reason`. */
export class FilterQueryParseError extends Error {
	public constructor(
		public readonly reason: FilterQueryParseFailure,
		options?: ErrorOptions,
	) {
		super(`Invalid filter query: ${reason}`, options);
		this.name = "FilterQueryParseError";
	}
}

export type FilterQueryParseResult = { readonly success: true; readonly query: FilterQuery } | { readonly success: false; readonly error: FilterQueryParseError };

/** Every node id in the tree, the root's included, in document order. */
function collectFilterNodeIds(node: FilterNode, into: string[]): string[] {
	into.push(node.id);
	if (isFilterGroup(node)) {
		for (const child of node.rules) {
			collectFilterNodeIds(child, into);
		}
	}
	return into;
}

/** Whether every node id in the tree is unique; every lookup here is by id. */
export function hasUniqueFilterIds(query: FilterQuery): boolean {
	const ids = collectFilterNodeIds(query, []);
	return new Set(ids).size === ids.length;
}

/**
 * The query as a string for a URL parameter, a saved view or a request body.
 * The tree itself is the contract; nothing is compiled here.
 */
export function serializeFilterQuery(query: FilterQuery): string {
	return JSON.stringify(query);
}

/**
 * Parses a serialized query from an untrusted source (a URL, storage, a
 * request). The tree is validated against `FilterQuerySchema` — bounded
 * strings, lists and depth — and node ids must be unique. Never throws.
 * A server must parse independently; this is the same schema it uses.
 */
export function parseFilterQuery(serialized: string): FilterQueryParseResult {
	let parsed: ReturnType<typeof FilterQuerySchema.safeParse>;
	try {
		parsed = FilterQuerySchema.safeParse(JSON.parse(serialized));
	} catch (error: unknown) {
		return { success: false, error: new FilterQueryParseError("invalid-json", { cause: error }) };
	}
	if (!parsed.success) {
		return { success: false, error: new FilterQueryParseError("invalid-shape", { cause: parsed.error }) };
	}
	if (!hasUniqueFilterIds(parsed.data)) {
		return { success: false, error: new FilterQueryParseError("duplicate-id") };
	}
	return { success: true, query: parsed.data };
}
