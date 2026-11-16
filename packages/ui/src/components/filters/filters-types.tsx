// The filter bar's types. The data model (values, rules, queries, operators, drafts, copy, issues) is shared with
// the native kit (@workspace/ui-kit-logic `filters`) and re-exported here; the fields, options and editors, which carry
// React nodes and components, are the web kit's own.

import type * as React from "react";
import {
	type FilterOperatorArity,
	type FilterValueType,
	type FilterChangeReason,
	type FilterValueItem,
	type FilterValue,
	type FilterRule,
	type FilterOperator,
	type FilterPayload,
	type FilterLoadContext,
	type FilterSortMode,
	type FilterEditorHost,
	type FilterCommitOptions,
	type FilterLabels,
} from "@workspace/ui-kit-logic";

export {
	FILTER_CHANGE_REASONS,
	FILTER_COMBINATORS,
	FILTER_DRAFT_STEPS,
	FILTER_ISO_DAY_PATTERN,
	FILTER_ISSUE_REASONS,
	FILTER_LIMITS,
	FILTER_OPERATOR_ARITIES,
	FILTER_RELATIVE_DATE_UNITS,
	FILTER_SORT_MODES,
	FILTER_TIME_PATTERN,
	FILTER_VALUE_TYPES,
	FilterChangeReasonSchema,
	FilterCombinatorSchema,
	FilterDateValueSchema,
	FilterDraftStepSchema,
	FilterGroupNodeSchema,
	FilterIssueReasonSchema,
	filterNodeDepth,
	FilterNodeSchema,
	FilterOperatorAritySchema,
	FilterQuerySchema,
	FilterRelativeDateSchema,
	FilterRelativeDateUnitSchema,
	FilterRuleSchema,
	FilterScalarSchema,
	FilterSortModeSchema,
	filterValueItems,
	FilterValueItemSchema,
	FilterBarValueListSchema as FilterValueListSchema,
	FilterValueSchema,
	FilterValueTypeSchema,
	isFilterDateValue,
	isFilterValueList,
	type FilterAdvancedMode,
	type FilterChangeReason,
	type FilterCombinator,
	type FilterCommitOptions,
	type FilterDateValue,
	type FilterDraft,
	type FilterDraftStep,
	type FilterEditorHost,
	type FilterEmptyStateContext,
	type FilterGroupNode,
	type FilterIssue,
	type FilterIssueColumn,
	type FilterIssueReason,
	type FilterLabels,
	type FilterLimits,
	type FilterLoadContext,
	type FilterNode,
	type FilterOperator,
	type FilterOperatorArity,
	type FilterOperatorCatalog,
	type FilterPayload,
	type FilterQuery,
	type FilterRelativeDate,
	type FilterRelativeDateUnit,
	type FilterRule,
	type FilterScalar,
	type FilterSortMode,
	type FilterValue,
	type FilterValueItem,
	type FilterValueList,
	type FilterValueType,
} from "@workspace/ui-kit-logic";
// Filters: a stepped filter builder with nested fields, popover value editors
// and a boolean query tree. This module holds the data contract — the query
// tree is DATA that crosses into URLs, saved views and API calls, so its shape
// is a zod schema and every type below that describes stored data is derived
// from one. Configuration the consumer writes in code (fields, operators,
// editors) is a plain interface: it never arrives over a wire.

/* -------------------------------------------------------------------------- */
/*                                   Limits                                   */
/* -------------------------------------------------------------------------- */

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

/** Result of `loadOptions`, or a bare list. */
export interface FilterLoadResult {
	readonly items: readonly FilterOption[];
	readonly nextCursor?: string | undefined;
	/** Defaults to whether `nextCursor` was supplied. */
	readonly hasMore?: boolean | undefined;
}

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
