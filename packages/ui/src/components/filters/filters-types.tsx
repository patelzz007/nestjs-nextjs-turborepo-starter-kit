// Filters: a stepped filter builder with nested fields, popover value editors
// and a boolean query tree. This module holds the data contract — the query
// tree is DATA that crosses into URLs, saved views and API calls, so its shape
// is a zod schema and every type below that describes stored data is derived
// from one. Configuration the consumer writes in code (fields, operators,
// editors) is a plain interface: it never arrives over a wire.

import { isArrayValue } from "@workspace/shared";
import type * as React from "react";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                   Limits                                   */
/* -------------------------------------------------------------------------- */

export interface FilterLimits {
	/** Longest stored text value or id. */
	readonly maxTextLength: number;
	/** Most values one rule may hold (a "many" or "range" arity). */
	readonly maxValues: number;
	/** Most children one group may hold. */
	readonly maxGroupSize: number;
	/** Deepest nesting a parsed query may have, the root group counting as one. */
	readonly maxDepth: number;
	/** Most segments a field path may have. */
	readonly maxPathLength: number;
	/** Largest relative-date offset, in units, either way. */
	readonly maxRelativeOffset: number;
}

/**
 * Upper bounds for a parsed query. A filter query arrives from URLs and saved
 * views, so every string, array and tree is bounded (rules/05).
 */
export const FILTER_LIMITS: FilterLimits = {
	maxTextLength: 1000,
	maxValues: 500,
	maxGroupSize: 200,
	maxDepth: 8,
	maxPathLength: 16,
	maxRelativeOffset: 3650,
};

/* -------------------------------------------------------------------------- */
/*                              Enumerated values                             */
/* -------------------------------------------------------------------------- */

export const FILTER_COMBINATORS: readonly ["and", "or"] = ["and", "or"];
export const FilterCombinatorSchema = z.enum(FILTER_COMBINATORS);
export type FilterCombinator = z.infer<typeof FilterCombinatorSchema>;

/**
 * How many values an operator takes. Answers "does this need a value editor"
 * for every operator, a consumer's own included.
 */
export const FILTER_OPERATOR_ARITIES: readonly ["none", "one", "many", "range"] = ["none", "one", "many", "range"];
export const FilterOperatorAritySchema = z.enum(FILTER_OPERATOR_ARITIES);
export type FilterOperatorArity = z.infer<typeof FilterOperatorAritySchema>;

/**
 * Which built-in editor a field uses by DEFAULT: `editor` overrides it, and an
 * operator's arity may override both. No date type on purpose: every product
 * wants a different date control, so a date ships as an `editor`.
 */
export const FILTER_VALUE_TYPES: readonly ["text", "number", "range", "select", "multiselect", "boolean"] = ["text", "number", "range", "select", "multiselect", "boolean"];
export const FilterValueTypeSchema = z.enum(FILTER_VALUE_TYPES);
export type FilterValueType = z.infer<typeof FilterValueTypeSchema>;

export const FILTER_CHANGE_REASONS: readonly ["add", "update", "remove", "duplicate", "negate", "reorder", "combinator", "clear"] = [
	"add",
	"update",
	"remove",
	"duplicate",
	"negate",
	"reorder",
	"combinator",
	"clear",
];
export const FilterChangeReasonSchema = z.enum(FILTER_CHANGE_REASONS);
export type FilterChangeReason = z.infer<typeof FilterChangeReasonSchema>;

/* -------------------------------------------------------------------------- */
/*                                Date values                                 */
/* -------------------------------------------------------------------------- */

export const FILTER_RELATIVE_DATE_UNITS: readonly ["day", "week", "month", "year"] = ["day", "week", "month", "year"];
export const FilterRelativeDateUnitSchema = z.enum(FILTER_RELATIVE_DATE_UNITS);
export type FilterRelativeDateUnit = z.infer<typeof FilterRelativeDateUnitSchema>;

/** A calendar offset from now, resolved at read time. */
export const FilterRelativeDateSchema = z
	.object({
		unit: FilterRelativeDateUnitSchema,
		offset: z.number().int().min(-FILTER_LIMITS.maxRelativeOffset).max(FILTER_LIMITS.maxRelativeOffset),
	})
	.strict()
	.readonly();
export type FilterRelativeDate = z.infer<typeof FilterRelativeDateSchema>;

/** `yyyy-MM-dd`, the stored form of an absolute day. */
export const FILTER_ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:mm`, a 24-hour time of day. */
export const FILTER_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/**
 * A date filter value. NOT a `Date`: a filter gets persisted (saved views,
 * shared URLs), and a resolved `Date` would freeze "created today" into one
 * fixed day. `date` and `relative` are mutually exclusive.
 */
export const FilterDateValueSchema = z
	.object({
		/** An absolute day, `yyyy-MM-dd`. */
		date: z.string().regex(FILTER_ISO_DAY_PATTERN).optional(),
		/** A token re-resolved on every read. */
		relative: FilterRelativeDateSchema.optional(),
		/** Optional time of day, `HH:mm`. */
		time: z.string().regex(FILTER_TIME_PATTERN).optional(),
	})
	.strict()
	.refine((value): boolean => value.date === undefined || value.relative === undefined, { message: "A date value is either absolute or relative, never both." })
	.readonly();
export type FilterDateValue = z.infer<typeof FilterDateValueSchema>;

/* -------------------------------------------------------------------------- */
/*                                Rule values                                 */
/* -------------------------------------------------------------------------- */

/** One stored primitive. `false` and `0` are values, never "blank". */
export const FilterScalarSchema = z.union([z.string().max(FILTER_LIMITS.maxTextLength), z.number(), z.boolean()]);
export type FilterScalar = z.infer<typeof FilterScalarSchema>;

/** One element of a stored value list. `null` is an unfilled range bound. */
export const FilterValueItemSchema = z.union([FilterScalarSchema, FilterDateValueSchema, z.null()]);
export type FilterValueItem = z.infer<typeof FilterValueItemSchema>;

/** A list value: the picks of a "many" operator, or the two bounds of a "range". */
export const FilterValueListSchema = z.array(FilterValueItemSchema).max(FILTER_LIMITS.maxValues).readonly();
export type FilterValueList = z.infer<typeof FilterValueListSchema>;

/**
 * A rule's value. SINGULAR, and the operator's `arity` decides its shape:
 * `"many"` holds a list, `"range"` a two-item list, `"none"` nothing.
 */
export const FilterValueSchema = z.union([FilterScalarSchema, FilterDateValueSchema, FilterValueListSchema]);
export type FilterValue = z.infer<typeof FilterValueSchema>;

/* -------------------------------------------------------------------------- */
/*                                 Query tree                                 */
/* -------------------------------------------------------------------------- */

const FilterIdSchema = z.string().min(1).max(FILTER_LIMITS.maxTextLength);

/**
 * One condition. `path` names the field, root first (`["name", "first"]` for a
 * nested attribute). `operator` is `""` while the user has not chosen one.
 */
export const FilterRuleSchema = z
	.object({
		id: FilterIdSchema,
		type: z.literal("rule"),
		path: z.array(z.string().min(1).max(FILTER_LIMITS.maxTextLength)).min(1).max(FILTER_LIMITS.maxPathLength).readonly(),
		operator: z.string().max(FILTER_LIMITS.maxTextLength),
		value: FilterValueSchema.optional(),
		/** Flips the meaning in place. Set by Negate when there is no `inverse`. */
		negated: z.boolean().optional(),
	})
	.strict()
	.readonly();
export type FilterRule = z.infer<typeof FilterRuleSchema>;

/**
 * Rules under one combinator. Written as an interface only because the tree is
 * recursive; `FilterGroupNodeSchema` is typed against it, so the two cannot drift.
 */
export interface FilterGroupNode {
	readonly id: string;
	readonly type: "group";
	readonly combinator: FilterCombinator;
	readonly rules: readonly FilterNode[];
}

export type FilterNode = FilterRule | FilterGroupNode;

export const FilterGroupNodeSchema: z.ZodType<FilterGroupNode> = z.lazy(() =>
	z
		.object({
			id: FilterIdSchema,
			type: z.literal("group"),
			combinator: FilterCombinatorSchema,
			rules: z.array(FilterNodeSchema).max(FILTER_LIMITS.maxGroupSize).readonly(),
		})
		.strict()
		.readonly(),
);

export const FilterNodeSchema: z.ZodType<FilterNode> = z.lazy(() => z.union([FilterRuleSchema, FilterGroupNodeSchema]));

/** A whole query. Always a group, so flat and nested are one code path. */
export type FilterQuery = FilterGroupNode;

/** How deep a node nests, itself counting as one. */
export function filterNodeDepth(node: FilterNode): number {
	if (node.type === "rule") {
		return 1;
	}
	let deepest = 0;
	for (const child of node.rules) {
		deepest = Math.max(deepest, filterNodeDepth(child));
	}
	return deepest + 1;
}

/** The query schema: a group no deeper than `FILTER_LIMITS.maxDepth` groups. */
export const FilterQuerySchema: z.ZodType<FilterQuery> = FilterGroupNodeSchema.refine((query: FilterQuery): boolean => filterNodeDepth(query) <= FILTER_LIMITS.maxDepth + 1, {
	message: `A filter query nests at most ${String(FILTER_LIMITS.maxDepth)} groups deep.`,
});

/** Second argument to `onQueryChange`, so nobody has to diff two trees. */
export interface FilterChangeDetails {
	readonly reason: FilterChangeReason;
	/** The rule that changed, or null for whole-query changes like `clear`. */
	readonly rule: FilterRule | null;
	/** The field the rule points at, resolved. Null when the path is unknown. */
	readonly field: FilterField | null;
}

/* -------------------------------------------------------------------------- */
/*                                  Operators                                 */
/* -------------------------------------------------------------------------- */

export interface FilterOperator {
	readonly value: string;
	readonly label: string;
	/** Defaults to `"one"`. */
	readonly arity?: FilterOperatorArity | undefined;
	/** The opposite operator. Negate flips to it, else sets `rule.negated`. */
	readonly inverse?: string | undefined;
	/** Hidden from the operator list but still valid in a restored query. */
	readonly hidden?: boolean | undefined;
}

/** The operator catalog, one list per built-in value type. */
export type FilterOperatorCatalog = Readonly<Record<FilterValueType, readonly FilterOperator[]>>;

/* -------------------------------------------------------------------------- */
/*                                   Fields                                   */
/* -------------------------------------------------------------------------- */

/** A consumer payload carried untouched on an option or a field. */
export type FilterPayload = Readonly<Record<string, string | number | boolean | null>>;

export interface FilterOption {
	readonly value: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly description?: string | undefined;
	readonly keywords?: readonly string[] | undefined;
	readonly disabled?: boolean | undefined;
	/**
	 * The row that means NONE OF THE ABOVE: Unassigned, No label. Picking it
	 * clears every other pick and picking anything else clears it, and it is
	 * drawn apart under a rule of its own. The value must be resolvable (in the
	 * field's static `options` or through `resolveValues`).
	 */
	readonly exclusive?: boolean | undefined;
	/** Arbitrary payload, carried untouched through every render callback. */
	readonly data?: FilterPayload | undefined;
}

export interface FilterLoadContext {
	/** Aborted when the query changes, the editor closes, or a load supersedes. */
	readonly signal: AbortSignal;
	readonly cursor?: string | undefined;
}

/** Result of `loadOptions`, or a bare list. */
export interface FilterLoadResult {
	readonly items: readonly FilterOption[];
	readonly nextCursor?: string | undefined;
	/** Defaults to whether `nextCursor` was supplied. */
	readonly hasMore?: boolean | undefined;
}

/** How an option list is ordered inside each group, and when pinning is taken. */
export const FILTER_SORT_MODES: readonly ["none", "label", "snapshot"] = ["none", "label", "snapshot"];
export const FilterSortModeSchema = z.enum(FILTER_SORT_MODES);
export type FilterSortMode = z.infer<typeof FilterSortModeSchema>;

/** A field, or a branch. A group of fields is a field with `fields`. */
export interface FilterField {
	/** Stable id. Unique among its siblings; the full path must be unique. */
	readonly id: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly description?: string | undefined;
	readonly keywords?: readonly string[] | undefined;
	/** Trailing count. Defaults to the known children. */
	readonly count?: number | undefined;
	readonly fields?: readonly FilterField[] | undefined;
	/** Whether a BRANCH is itself filterable. Leaves always are. */
	readonly selectable?: boolean | undefined;
	readonly disabled?: boolean | undefined;

	readonly type?: FilterValueType | undefined;
	readonly options?: readonly FilterOption[] | undefined;
	/** Async options, paged via `cursor`. Any `options` also seed the cache. */
	readonly loadOptions?: ((query: string, context: FilterLoadContext) => readonly FilterOption[] | Promise<readonly FilterOption[] | FilterLoadResult>) | undefined;
	/** Resolves stored values the loader never returned, for restored chips. */
	readonly resolveValues?: ((values: readonly string[]) => readonly FilterOption[] | Promise<readonly FilterOption[]>) | undefined;

	/** Operators for this field. Falls back to the catalog for its `type`. */
	readonly operators?: readonly FilterOperator[] | ((field: FilterField) => readonly FilterOperator[]) | undefined;
	/**
	 * The operator this field FALLS BACK to when an existing rule changes field.
	 * A new rule always starts with no operator so the condition menu opens.
	 */
	readonly defaultOperator?: string | undefined;

	/** Overrides the editor chosen from `type`. A registry name or a component. */
	readonly editor?: FilterEditorRef | undefined;
	readonly renderValue?: ((context: FilterValueDisplayContext) => React.ReactNode) | undefined;
	/** The value as PLAIN TEXT for an accessible name. */
	readonly valueText?: ((context: FilterValueDisplayContext) => string) | undefined;

	/** Placeholder for the value editor's input, or an option list's search. */
	readonly placeholder?: string | undefined;
	/** SHOWS the search box (default true). Off keeps it, visually hidden. */
	readonly searchable?: boolean | undefined;
	/** Whether an option editor stacks the picks at the top of its list. */
	readonly pinSelected?: boolean | undefined;
	readonly sortSelected?: FilterSortMode | undefined;
	/**
	 * This field's own validity check: return a MESSAGE to mark the value
	 * invalid, or `null` / `undefined` when the value is fine. Runs only after
	 * the built-in checks pass.
	 */
	readonly validate?: ((context: FilterValidateContext) => string | null | undefined) | undefined;
	/** Reaches the value editor's PANEL, merged last. */
	readonly className?: string | undefined;

	/** The storage column when it differs from the UI path. Never read here. */
	readonly column?: string | undefined;
	readonly data?: FilterPayload | undefined;
}

/* -------------------------------------------------------------------------- */
/*                                   Editors                                  */
/* -------------------------------------------------------------------------- */

/**
 * Where an editor renders: `"create"` is a wizard step (advances on commit),
 * `"amend"` the chip-anchored popover (offers Discard and Apply).
 */
export type FilterEditorHost = "create" | "amend";

export interface FilterOptionsState {
	readonly items: readonly FilterOption[];
	readonly loading: boolean;
	readonly error: boolean;
	readonly hasMore: boolean;
	/** Current search text. Debounced before it reaches `loadOptions`. */
	readonly query: string;
	readonly setQuery: (query: string) => void;
	readonly loadMore: () => void;
	readonly retry: () => void;
	/** Resolves a stored value to its option, from cache when possible. */
	readonly resolve: (value: string) => FilterOption | undefined;
}

export interface FilterCommitOptions {
	/** Dismiss the host after writing. Defaults to true. */
	readonly close?: boolean | undefined;
}

/** The attribute a host looks for when its panel opens, to move focus onto. */
export const FILTER_AUTOFOCUS_ATTRIBUTE = "data-filter-autofocus";

/**
 * Spread onto whichever element should take focus when the editor's panel
 * opens. A MARKER attribute, not a ref or `autoFocus`: the host's popover moves
 * focus onto it as it opens (falling back to the first focusable element).
 */
export type FilterAutoFocusProps = Readonly<Record<typeof FILTER_AUTOFOCUS_ATTRIBUTE, true>>;

/** The one value hosts hand every editor. */
export const FILTER_AUTOFOCUS_PROPS: FilterAutoFocusProps = { [FILTER_AUTOFOCUS_ATTRIBUTE]: true };

export interface FilterEditorProps {
	readonly field: FilterField;
	readonly operator: FilterOperator;
	/** The DRAFT value. An editor edits a draft; the host commits it. */
	readonly value: FilterValue | undefined;
	readonly onValueChange: (value: FilterValue | undefined) => void;
	readonly host: FilterEditorHost;
	/** Spread onto whichever element should take focus when the panel opens. */
	readonly autoFocusProps: FilterAutoFocusProps;
	/** Accept the draft. `{ close: false }` writes through without dismissing. */
	readonly commit: (value?: FilterValue, options?: FilterCommitOptions) => void;
	readonly cancel: () => void;
	/** Step back. Only meaningful when `host === "create"`. */
	readonly back: () => void;
	readonly options: FilterOptionsState;
	readonly labels: FilterLabels;
}

export type FilterEditor = React.ComponentType<FilterEditorProps>;

export type FilterEditorRegistry = Readonly<Record<string, FilterEditor>>;

/** A registered editor's name, or a component. */
export type FilterEditorRef = string | FilterEditor;

/** Which box the advanced builder is in. */
export type FilterAdvancedMode = "popover" | "inline";

/** Context for a custom builder empty state. Its actions ARE the footer's. */
export interface FilterEmptyStateContext {
	readonly labels: FilterLabels;
	/** The bar is locked. A custom state should not offer an action here. */
	readonly readOnly: boolean;
	readonly mode: FilterAdvancedMode;
	/** Appends a condition and opens its attribute picker. */
	readonly addFilter: () => void;
	readonly addGroup: () => void;
}

export interface FilterValueDisplayContext {
	readonly value: FilterValue | undefined;
	/** `value` normalised to a list, so callbacks never re-derive it. */
	readonly values: readonly FilterValueItem[];
	readonly field: FilterField;
	readonly operator: FilterOperator;
	/** Options already resolved for `value`, when the field is option-backed. */
	readonly options: readonly FilterOption[];
	readonly labels: FilterLabels;
}

/* -------------------------------------------------------------------------- */
/*                                   Index                                    */
/* -------------------------------------------------------------------------- */

export interface FilterIndexEntry {
	readonly field: FilterField;
	readonly path: readonly string[];
}

/** Normalized schema, keyed by SIGNATURE: call sites inline the array. */
export interface FilterIndex {
	/** Every field by its joined path. */
	readonly byPath: ReadonlyMap<string, FilterField>;
	/** Child fields by parent path. Root fields are keyed by `FILTER_ROOT_KEY`. */
	readonly childrenOf: ReadonlyMap<string, readonly FilterField[]>;
	/** Parent path by path. Empty string for a root field. */
	readonly parentOf: ReadonlyMap<string, string>;
	/** Every field in stable, depth-first order. */
	readonly all: readonly FilterIndexEntry[];
	/** Top level fields, in input order. */
	readonly roots: readonly FilterField[];
	/** Content hash; equal schemas share one, so a rebuild reuses the index. */
	readonly signature: string;
}

/* -------------------------------------------------------------------------- */
/*                                    Draft                                   */
/* -------------------------------------------------------------------------- */

export const FILTER_DRAFT_STEPS: readonly ["field", "operator", "value"] = ["field", "operator", "value"];
export const FilterDraftStepSchema = z.enum(FILTER_DRAFT_STEPS);
export type FilterDraftStep = z.infer<typeof FilterDraftStepSchema>;

/**
 * The in-flight filter. `cascaderPath` (the field picker's browse level; the
 * name is reui's) is kept SEPARATE from `path`: `path` is what the user chose,
 * `cascaderPath` is where they were browsing when they chose it, and Back has
 * to return there.
 */
export interface FilterDraft {
	readonly step: FilterDraftStep;
	/** `"ready"` = complete: the host writes it into the query and closes. */
	readonly status: "editing" | "ready";
	/** Set when amending an existing rule, null when creating a new one. */
	readonly ruleId: string | null;
	/** The chosen field path. Empty until the field step commits. */
	readonly path: readonly string[];
	readonly cascaderPath: readonly string[];
	readonly operator: string | null;
	readonly value: FilterValue | undefined;
	readonly query: string;
}

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every user-facing string the filters family renders or announces. Supplied
 * by the app's `UiKitLabelsProvider` (family `filters`) and overridable per
 * bar through the `labels` prop.
 */
export interface FilterLabels {
	readonly addFilter: string;
	readonly advancedFilter: string;
	/** The line above the builder's rows, "In this view, show records". */
	readonly showRecords: string;
	/** Empty-state title. The HINT below is withheld from a read-only bar. */
	readonly builderEmpty: string;
	readonly builderEmptyHint: string;
	/** Appends a condition to the root group, from the builder's footer. */
	readonly addCondition: string;
	readonly addConditionGroup: string;
	/** A group's own add button; NAMES a button that shows `addCondition`. */
	readonly addToGroup: string;
	readonly removeGroup: string;
	readonly wrapInGroup: string;
	/** Dissolves a group into its parent. The inverse of `wrapInGroup`. */
	readonly ungroup: string;
	/** Moves a condition to the root group. The keyboard path to that drag. */
	readonly moveToTopLevel: string;
	/** Groups have no names, so they are numbered in document order, one-based. */
	readonly moveToGroup: (position: number) => string;
	/** Accessible name of a row's or a group's drag handle. */
	readonly reorder: string;
	/** Description on the drag handle, teaching the Alt+Arrow keyboard model. */
	readonly reorderHint: string;
	readonly groupAll: string;
	readonly groupAny: string;
	readonly groupPlaceholder: string;
	/** Names a builder row. Depth is in it: indentation is invisible to AT. */
	readonly rowLabel: (condition: string, depth: number) => string;
	readonly groupLabel: (description: string, depth: number) => string;
	readonly groupAnnouncement: (added: boolean) => string;
	readonly reorderAnnouncement: (label: string, position: number, total: number) => string;
	/** A cross-PARENT move. */
	readonly moveAnnouncement: (label: string, destination: string, position: number, total: number) => string;
	readonly clearAll: string;
	/** Names a group's menu; distinct from `chipMenu`, which is per-rule. */
	readonly groupMenu: string;
	readonly searchFields: string;
	readonly searchOperators: string;
	readonly searchOptions: string;
	readonly back: string;
	readonly clear: string;
	readonly apply: string;
	readonly discard: string;
	readonly empty: string;
	readonly loading: string;
	readonly loadingMore: string;
	readonly loadMore: string;
	readonly error: string;
	readonly retry: string;
	/** Leading word before the first rule, where a combinator would otherwise go. */
	readonly where: string;
	readonly and: string;
	readonly or: string;
	/** Accessible name of the combinator toggle between two chips. */
	readonly combinator: string;
	/** Builder combinator toggle; the name CONTAINS the visible word. */
	readonly combinatorLabel: (word: string) => string;
	readonly duplicate: string;
	readonly negate: string;
	/** Chip menu's route into the builder. Needs `onConvertToAdvanced`. */
	readonly convertToAdvanced: string;
	readonly remove: string;
	/** Names a chip's menu button. The builder's row menu reads the same key. */
	readonly chipMenu: (fieldLabel: string) => string;
	readonly filtersLabel: string;
	readonly filterLabel: (condition: string) => string;
	/** Prose, not ARIA: `aria-readonly` is invalid on toolbar, group and button. */
	readonly readOnly: string;
	/** Joins ancestors in a nested field path, "Name > First". */
	readonly pathSeparator: string;
	readonly valuePlaceholder: string;
	/** Empty word for an OPTION value; `placeholder` is the search prompt. */
	readonly selectPlaceholder: string;
	/** Spoken for an empty value. */
	readonly noValue: string;
	/** Shown in the operator segment before a condition has been chosen. */
	readonly selectCondition: string;
	/** Appended to a chip with no condition. */
	readonly incomplete: string;
	/** Appended to a branch row's accessible name in the field picker. */
	readonly branchAffordance: string;
	/** A FRAGMENT appended to an exclusive row's accessible name. */
	readonly exclusiveHint: string;
	readonly exclusiveAnnouncement: (label: string, cleared: number) => string;
	readonly itemCount: (count: number) => string;
	readonly fieldsLabel: string;
	/** Live-region text after a query narrows an option list or the picker. */
	readonly resultsAnnouncement: (count: number) => string;
	/** Accessible name of an option menu's footer (Load more, Retry). */
	readonly actionsLabel: string;
	/** For a CONSUMER-composed wizard; the shipped flow announces counts. */
	readonly stepAnnouncement: (step: FilterDraftStep, label: string) => string;
	readonly countAnnouncement: (count: number) => string;
	readonly valueCount: (count: number) => string;
	/** Spells out the list behind the `valueCount` summary, and contains it. */
	readonly valueDetail: (summary: string, values: readonly string[]) => string;
	readonly valueRange: (from: string, to: string) => string;
	readonly rangeFrom: (fieldLabel: string) => string;
	readonly rangeTo: (fieldLabel: string) => string;
	readonly rangeSeparator: string;
	/** Rendered for a `negated` rule, wrapping the operator label. */
	readonly negated: (operatorLabel: string) => string;
	/** The two words a boolean value reads as. */
	readonly booleanTrue: string;
	readonly booleanFalse: string;
	/** A relative date read as words ("today", "in 3 days"), never as the resolved day. */
	readonly relativeDate: (relative: FilterRelativeDate) => string;
	readonly issueOperator: string;
	readonly issueValue: string;
	readonly issueRange: string;
	readonly issueRangeOrder: string;
	readonly issueEmptyGroup: string;
	/** The roll-up, and the name of the button that jumps to the first issue. */
	readonly issueSummary: (count: number) => string;
}

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

/** Why a node cannot run as written. `collectFilterIssues` produces these. */
export const FILTER_ISSUE_REASONS: readonly ["missing-operator", "missing-value", "incomplete-range", "reversed-range", "empty-group", "custom"] = [
	"missing-operator",
	"missing-value",
	"incomplete-range",
	"reversed-range",
	"empty-group",
	"custom",
];
export const FilterIssueReasonSchema = z.enum(FILTER_ISSUE_REASONS);
export type FilterIssueReason = z.infer<typeof FilterIssueReasonSchema>;

/** WHICH cell an issue marks. Two reasons share the value cell; groups have none. */
export type FilterIssueColumn = "operator" | "value" | "group";

export interface FilterIssue {
	readonly nodeId: string;
	readonly column: FilterIssueColumn;
	readonly reason: FilterIssueReason;
	/** Set only for `reason: "custom"`; the rest look up `FilterLabels`. */
	readonly message?: string | undefined;
}

/** What a field's `validate` is handed. SYNCHRONOUS. */
export interface FilterValidateContext {
	readonly value: FilterValue | undefined;
	readonly values: readonly FilterValueItem[];
	readonly field: FilterField;
	readonly operator: FilterOperator;
	/** How many values this operator takes, already resolved. */
	readonly arity: FilterOperatorArity;
	readonly rule: FilterRule;
	readonly labels: FilterLabels;
}

/* -------------------------------------------------------------------------- */
/*                               Value narrowing                              */
/* -------------------------------------------------------------------------- */

/** Whether a stored item is a date value. Zod-backed, so it narrows honestly. */
export function isFilterDateValue(value: FilterValue | FilterValueItem | undefined): value is FilterDateValue {
	return FilterDateValueSchema.safeParse(value).success;
}

/** Whether a stored value is a list (a "many" or "range" value). */
export function isFilterValueList(value: FilterValue | undefined): value is FilterValueList {
	return isArrayValue(value);
}

/** A value normalised to a list, so no caller re-derives arity. */
export function filterValueItems(value: FilterValue | undefined): readonly FilterValueItem[] {
	if (value === undefined) {
		return [];
	}
	if (isFilterValueList(value)) {
		return value;
	}
	return [value];
}
