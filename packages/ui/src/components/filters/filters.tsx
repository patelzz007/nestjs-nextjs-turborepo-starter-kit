"use client";

import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

import { FiltersAdvanced } from "./filters-advanced";
import { FiltersBuilder } from "./filters-builder";
import { FilterChip } from "./filters-chip";
import {
	createFilterFocusStore,
	createFilterResolutionStore,
	createFilterRowStateStore,
	FilterActionsContext,
	filterControlSizes,
	FilterFocusContext,
	filterReadOnlyProps,
	FilterRenderContext,
	FilterRowStateProvider,
	FilterStateContext,
	isFilterLocked,
	NO_FILTER_FOCUS,
	useFilterActions,
	useFilterFocusStore,
	useFilterState,
	type FilterActionsContextValue,
	type FilterFocusSegment,
	type FilterRenderContextValue,
	type FilterSize,
	type FilterStateContextValue,
	type FilterVariant,
} from "./filters-context";
import { filterDraftReducer, isFilterDraftCommittable, type FilterDraftAction } from "./filters-draft";
import { DEFAULT_FILTER_EDITORS, resolveFilterEditor } from "./filters-editors";
import {
	computeFilterSchemaSignature,
	createFilterIdFactory,
	DEFAULT_FILTER_MAX_PATH_SEGMENTS,
	findFilterSchemaIssues,
	getCachedFilterIndex,
	formatFilterPath,
	getFilterField,
	warnFilterOnce,
	type FilterPathCollapse,
} from "./filters-lib";
import { createFilterOperators, getFilterOperator, negateFilterOperator, operatorTakesValue, resolveFilterOperators, type FilterOperatorLabels } from "./filters-operators";
import {
	clearFilterQuery,
	copyFilterNodeTo,
	countFilterRules,
	createFilterGroup,
	createFilterRule,
	duplicateFilterNode,
	findFilterNode,
	findFilterRule,
	flattenFilterRules,
	insertFilterNode,
	isFilterRule,
	moveFilterNode,
	moveFilterNodeTo,
	removeFilterNode,
	setFilterCombinator,
	toggleFilterCombinator,
	unwrapFilterGroup,
	updateFilterRule,
	wrapFilterNodeInGroup,
	type FilterRuleUpdates,
} from "./filters-query";
import type {
	FilterAdvancedMode,
	FilterChangeDetails,
	FilterChangeReason,
	FilterCombinator,
	FilterDraft,
	FilterDraftStep,
	FilterEditor,
	FilterEditorRegistry,
	FilterEmptyStateContext,
	FilterField,
	FilterLabels,
	FilterOperator,
	FilterQuery,
	FilterRule,
	FilterValueDisplayContext,
} from "./filters-types";

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

export const filtersVariants = cva("flex flex-wrap items-center", {
	variants: {
		size: { sm: "gap-1.5", default: "gap-2" },
		state: { default: "", disabled: "opacity-50", readonly: "" },
	},
	defaultVariants: { size: "default", state: "default" },
});

type FiltersState = "default" | "disabled" | "readonly";

function resolveFiltersState(disabled: boolean, readOnly: boolean): FiltersState {
	if (disabled) {
		return "disabled";
	}
	return readOnly ? "readonly" : "default";
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

export interface FiltersProps {
	/** The field schema. Nested via each field's own `fields`. */
	readonly fields: readonly FilterField[];
	/** The query. CONTROLLED: the bar holds no copy of it. */
	readonly query: FilterQuery;
	/** Every change the bar makes, with the reason, the rule and its field. */
	readonly onQueryChange: (query: FilterQuery, details: FilterChangeDetails) => void;
	/** Per-bar overrides of the `filters` label family. Keep it a stable object. */
	readonly labels?: Partial<FilterLabels> | undefined;
	/** Per-bar overrides of the `filterOperators` label family. */
	readonly operatorLabels?: Partial<FilterOperatorLabels> | undefined;
	/** Extra or replacement value editors, resolved by a field's `editor` name. */
	readonly editors?: FilterEditorRegistry | undefined;
	/** `"basic"` is the flat chip row; `"advanced"` the nested condition builder. */
	readonly variant?: FilterVariant | undefined;
	/** Where the advanced builder lives. `"inline"` renders the panel in place. */
	readonly advancedMode?: FilterAdvancedMode | undefined;
	readonly advancedAlign?: "start" | "center" | "end" | undefined;
	/** Whether the advanced builder's rows can be REORDERED (drag and Alt+Arrow). */
	readonly reorderable?: boolean | undefined;
	readonly size?: FilterSize | undefined;
	readonly disabled?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	/** ONE VETO POINT for every change the bar makes. Return `false` to refuse. */
	readonly onBeforeQueryChange?: ((query: FilterQuery, details: FilterChangeDetails) => boolean | undefined) | undefined;
	/** Offers "Advanced editor" in every chip's menu; its presence IS the switch. */
	readonly onConvertToAdvanced?: (() => void) | undefined;
	readonly menuClassName?: string | undefined;
	readonly fieldPickerClassName?: string | undefined;
	/** How a NESTED attribute path is shortened when too deep to read. */
	readonly pathCollapse?: FilterPathCollapse | undefined;
	readonly maxPathSegments?: number | undefined;
	/** Replaces the default Add filter (or Advanced filter) button. */
	readonly trigger?: React.ReactElement | undefined;
	/** Renders a Clear button once the query holds anything. */
	readonly showClear?: boolean | undefined;
	readonly renderValue?: ((context: FilterValueDisplayContext) => React.ReactNode) | undefined;
	readonly renderChip?: ((rule: FilterRule) => React.ReactNode) | undefined;
	readonly renderEmpty?: ((context: FilterEmptyStateContext) => React.ReactNode) | undefined;
	readonly className?: string | undefined;
	/** A consumer-composed chrome; replaces the default row or builder. */
	readonly children?: React.ReactNode;
}

interface LatestRootState {
	readonly index: FilterActionsContextValue["index"];
	readonly labels: FilterLabels;
	readonly resolveOperators: (field: FilterField) => readonly FilterOperator[];
	readonly query: FilterQuery;
	readonly onQueryChange: FiltersProps["onQueryChange"];
	readonly onBeforeQueryChange: FiltersProps["onBeforeQueryChange"];
	readonly disabled: boolean;
	readonly readOnly: boolean;
}

interface Announced {
	readonly seq: number;
	readonly text: string;
}

const NO_ANNOUNCEMENT: Announced = { seq: 0, text: "" };

/** The headline that names a group's combinator. */
function groupHeadline(combinator: FilterCombinator, labels: FilterLabels): string {
	return combinator === "and" ? labels.groupAll : labels.groupAny;
}

/**
 * The filters root: publishes the schema, labels, operators, editors and every
 * mutator to its chrome, and draws the chip row (`variant="basic"`) or the
 * advanced builder. Fully controlled: `query` in, `onQueryChange` out.
 */
export const Filters = React.forwardRef<HTMLDivElement, FiltersProps>(function Filters(
	{
		fields,
		query,
		onQueryChange,
		labels: labelsOverride,
		operatorLabels: operatorLabelsOverride,
		editors: editorsOverride,
		variant = "basic",
		advancedMode = "popover",
		advancedAlign = "start",
		reorderable = false,
		size = "default",
		disabled = false,
		readOnly = false,
		onBeforeQueryChange,
		onConvertToAdvanced,
		menuClassName,
		fieldPickerClassName,
		pathCollapse = "none",
		maxPathSegments = DEFAULT_FILTER_MAX_PATH_SEGMENTS,
		trigger,
		showClear = false,
		renderValue,
		renderChip,
		renderEmpty,
		className,
		children,
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("filters", labelsOverride);
	const operatorLabels = useUiKitLabels("filterOperators", operatorLabelsOverride);
	const [draft, setDraft] = React.useState<FilterDraft | null>(null);
	const draftRef = React.useRef<FilterDraft | null>(null);
	const [announced, setAnnounced] = React.useState<Announced>(NO_ANNOUNCEMENT);

	const idSeed = React.useId();
	const nextId = React.useMemo((): (() => string) => createFilterIdFactory(`${idSeed}f`), [idSeed]);
	const focusStore = React.useMemo(createFilterFocusStore, []);
	const rowStateStore = React.useMemo(createFilterRowStateStore, []);
	const resolutionStore = React.useMemo(createFilterResolutionStore, []);

	// `fields` is an inline literal at most call sites: the cheap signature runs
	// every render, and the index memoizes on it.
	const signature = computeFilterSchemaSignature(fields);
	const fieldsRef = React.useRef(fields);
	React.useEffect((): void => {
		fieldsRef.current = fields;
	});
	const index = getCachedFilterIndex(fields, signature);
	const operatorCatalog = React.useMemo(() => createFilterOperators(operatorLabels), [operatorLabels]);
	const editors = React.useMemo(
		(): FilterEditorRegistry => (editorsOverride === undefined ? DEFAULT_FILTER_EDITORS : { ...DEFAULT_FILTER_EDITORS, ...editorsOverride }),
		[editorsOverride],
	);
	const resolveOperators = React.useCallback((field: FilterField): readonly FilterOperator[] => resolveFilterOperators(field, operatorCatalog), [operatorCatalog]);
	const resolveEditor = React.useCallback(
		(field: FilterField, operator: FilterOperator | undefined): FilterEditor | undefined => resolveFilterEditor(field, operator, editors),
		[editors],
	);
	const ruleCount = React.useMemo((): number => countFilterRules(query), [query]);

	const latest = React.useRef<LatestRootState>({ index, labels, resolveOperators, query, onQueryChange, onBeforeQueryChange, disabled, readOnly });
	React.useEffect((): void => {
		latest.current = { index, labels, resolveOperators, query, onQueryChange, onBeforeQueryChange, disabled, readOnly };
	});

	const announce = React.useCallback((message: string): void => {
		if (message === "") {
			return;
		}
		setAnnounced((previous: Announced): Announced => ({ seq: previous.seq + 1, text: message }));
	}, []);

	/** THE MUTATION BOUNDARY: both the render-time flags and the latest ref. */
	const locked = React.useCallback((): boolean => disabled || readOnly || isFilterLocked(latest.current), [disabled, readOnly]);

	/** Reports whether the write LANDED. Updates the ref at once so chained mutations see it. */
	const emit = React.useCallback(
		(next: FilterQuery, reason: FilterChangeReason, rule: FilterRule | null): boolean => {
			if (locked()) {
				return false;
			}
			const field = rule === null ? null : (getFilterField(latest.current.index, rule.path) ?? null);
			const details: FilterChangeDetails = { reason, rule, field };
			if (latest.current.onBeforeQueryChange?.(next, details) === false) {
				return false;
			}
			latest.current = { ...latest.current, query: next };
			latest.current.onQueryChange(next, details);
			return true;
		},
		[locked],
	);

	// Drops the roving tab stop when the node holding it no longer exists.
	React.useEffect((): void => {
		const { id } = focusStore.getSnapshot();
		if (id !== null && findFilterNode(query, id) === null) {
			focusStore.set(NO_FILTER_FOCUS);
		}
	}, [query, focusStore]);

	const current = React.useCallback((): FilterQuery => latest.current.query, []);

	const addRule = React.useCallback(
		(rule: FilterRule, parentId?: string): void => {
			const next = insertFilterNode(current(), rule, parentId);
			if (emit(next, "add", rule)) {
				announce(latest.current.labels.countAnnouncement(countFilterRules(next)));
			}
		},
		[current, emit, announce],
	);

	const addGroup = React.useCallback(
		(parentId?: string, combinator: FilterCombinator = "or"): string => {
			// Before `nextId`, so a LOCKED bar cannot drift the SSR-seeded sequence.
			if (locked()) {
				return "";
			}
			const id = nextId();
			const next = insertFilterNode(current(), createFilterGroup({ id, combinator }), parentId);
			if (!emit(next, "add", null)) {
				return "";
			}
			announce(latest.current.labels.groupAnnouncement(true));
			return id;
		},
		[locked, nextId, current, emit, announce],
	);

	const updateRule = React.useCallback(
		(id: string, updates: FilterRuleUpdates): void => {
			const before = current();
			const next = updateFilterRule(before, id, updates);
			if (next === before) {
				return;
			}
			// THE VALUE arms a row's errors; a field re-pick (`path`) starts it over.
			if (updates.path !== undefined) {
				rowStateStore.unmark(id);
			} else if ("value" in updates) {
				rowStateStore.mark(id);
			}
			emit(next, "update", findFilterRule(next, id));
		},
		[current, emit, rowStateStore],
	);

	const removeNode = React.useCallback(
		(id: string): void => {
			const before = current();
			const removed = findFilterRule(before, id);
			const next = removeFilterNode(before, id);
			if (next === before || !emit(next, "remove", removed)) {
				return;
			}
			announce(removed === null ? latest.current.labels.groupAnnouncement(false) : latest.current.labels.countAnnouncement(countFilterRules(next)));
		},
		[current, emit, announce],
	);

	const duplicateNode = React.useCallback(
		(id: string): void => {
			const before = current();
			const next = duplicateFilterNode(before, id, nextId);
			if (next === before || !emit(next, "duplicate", findFilterRule(before, id))) {
				return;
			}
			announce(latest.current.labels.countAnnouncement(countFilterRules(next)));
		},
		[current, nextId, emit, announce],
	);

	const negateRule = React.useCallback(
		(id: string): void => {
			const before = current();
			const rule = findFilterRule(before, id);
			const field = rule === null ? undefined : getFilterField(latest.current.index, rule.path);
			if (rule === null || field === undefined) {
				return;
			}
			const operators = latest.current.resolveOperators(field);
			const flipped = negateFilterOperator(getFilterOperator(operators, rule.operator), operators, rule.negated);
			const next = updateFilterRule(before, id, { operator: flipped.operator ?? rule.operator, negated: flipped.negated ? true : undefined });
			emit(next, "negate", findFilterRule(next, id));
		},
		[current, emit],
	);

	/** Says where a node LANDED: focus stays on the handle, so nothing else reports it. */
	const announceReorder = React.useCallback(
		(next: FilterQuery, id: string, fromParentId: string | null): void => {
			const found = findFilterNode(next, id);
			if (found?.parent == null) {
				return;
			}
			const currentLabels = latest.current.labels;
			const label = isFilterRule(found.node)
				? formatFilterPath(latest.current.index, found.node.path, currentLabels.pathSeparator)
				: groupHeadline(found.node.combinator, currentLabels);
			const position = found.index + 1;
			const total = found.parent.rules.length;
			if (fromParentId !== null && fromParentId !== found.parent.id) {
				const destination = found.parent.id === next.id ? currentLabels.filtersLabel : groupHeadline(found.parent.combinator, currentLabels);
				announce(currentLabels.moveAnnouncement(label, destination, position, total));
				return;
			}
			announce(currentLabels.reorderAnnouncement(label, position, total));
		},
		[announce],
	);

	const moveNode = React.useCallback(
		(id: string, delta: number): void => {
			const before = current();
			const next = moveFilterNode(before, id, delta);
			if (next !== before && emit(next, "reorder", findFilterRule(next, id))) {
				announceReorder(next, id, null);
			}
		},
		[current, emit, announceReorder],
	);

	const moveNodeTo = React.useCallback(
		(id: string, parentId: string, position: number): void => {
			const before = current();
			const fromParentId = findFilterNode(before, id)?.parent?.id ?? null;
			const next = moveFilterNodeTo(before, id, parentId, position);
			if (next !== before && emit(next, "reorder", findFilterRule(next, id))) {
				announceReorder(next, id, fromParentId);
			}
		},
		[current, emit, announceReorder],
	);

	const copyNodeTo = React.useCallback(
		(id: string, parentId: string, position: number): void => {
			const before = current();
			const next = copyFilterNodeTo(before, id, parentId, position, nextId);
			if (next !== before && emit(next, "duplicate", findFilterRule(before, id))) {
				announce(latest.current.labels.countAnnouncement(countFilterRules(next)));
			}
		},
		[current, nextId, emit, announce],
	);

	const wrapNodeInGroup = React.useCallback(
		(id: string, combinator: FilterCombinator = "or"): void => {
			if (locked()) {
				return;
			}
			const before = current();
			const next = wrapFilterNodeInGroup(before, id, nextId(), combinator);
			if (next !== before && emit(next, "add", findFilterRule(next, id))) {
				announce(latest.current.labels.groupAnnouncement(true));
			}
		},
		[locked, current, nextId, emit, announce],
	);

	const unwrapGroup = React.useCallback(
		(groupId: string): void => {
			const before = current();
			const next = unwrapFilterGroup(before, groupId);
			if (next !== before && emit(next, "remove", null)) {
				announce(latest.current.labels.groupAnnouncement(false));
			}
		},
		[current, emit, announce],
	);

	const setCombinator = React.useCallback(
		(groupId: string, combinator: FilterCombinator): void => {
			const before = current();
			const next = setFilterCombinator(before, groupId, combinator);
			if (next !== before && emit(next, "combinator", null)) {
				announce(groupHeadline(combinator, latest.current.labels));
			}
		},
		[current, emit, announce],
	);

	const toggleCombinator = React.useCallback(
		(groupId: string): void => {
			const before = current();
			const next = toggleFilterCombinator(before, groupId);
			if (next === before || !emit(next, "combinator", null)) {
				return;
			}
			const group = findFilterNode(next, groupId)?.node;
			if (group !== undefined && !isFilterRule(group)) {
				announce(groupHeadline(group.combinator, latest.current.labels));
			}
		},
		[current, emit, announce],
	);

	const clearQuery = React.useCallback((): void => {
		const before = current();
		const next = clearFilterQuery(before);
		if (next !== before && emit(next, "clear", null)) {
			announce(latest.current.labels.countAnnouncement(0));
		}
	}, [current, emit, announce]);

	const writeDraft = React.useCallback((next: FilterDraft | null): void => {
		draftRef.current = next;
		setDraft(next);
	}, []);

	/** The draft becomes a rule exactly once, when the reducer says it is ready. */
	const commitDraft = React.useCallback(
		(ready: FilterDraft): void => {
			if (ready.ruleId !== null) {
				updateRule(ready.ruleId, { path: ready.path, operator: ready.operator ?? "", value: ready.value });
				return;
			}
			if (locked()) {
				return;
			}
			const id = nextId();
			// Empty on purpose: the chip renders "Select condition" and opens its menu.
			addRule(createFilterRule({ id, path: ready.path, operator: "" }));
			focusStore.set({ id, segment: "operator", autoOpen: true });
		},
		[updateRule, locked, nextId, addRule, focusStore],
	);

	// A draft is a MUTATION in progress, so it locks with the rest, except `close`.
	const dispatchDraft = React.useCallback(
		(action: FilterDraftAction): void => {
			if (action.type !== "close" && locked()) {
				return;
			}
			const next = filterDraftReducer(draftRef.current, action);
			if (next?.status === "ready" && isFilterDraftCommittable(next)) {
				commitDraft(next);
				writeDraft(null);
				return;
			}
			writeDraft(next);
		},
		[locked, commitDraft, writeDraft],
	);

	const openCreate = React.useCallback((): void => {
		dispatchDraft({ type: "openCreate" });
	}, [dispatchDraft]);

	const openAmend = React.useCallback(
		(id: string, step: FilterDraftStep): void => {
			const rule = findFilterRule(current(), id);
			if (rule !== null) {
				dispatchDraft({ type: "openAmend", ruleId: id, step, path: rule.path, operator: rule.operator, value: rule.value });
			}
		},
		[current, dispatchDraft],
	);

	const closeDraft = React.useCallback((): void => {
		dispatchDraft({ type: "close" });
	}, [dispatchDraft]);

	const getDraft = React.useCallback((): FilterDraft | null => draftRef.current, []);

	React.useEffect((): void => {
		if (process.env.NODE_ENV === "production") {
			return;
		}
		const issues = findFilterSchemaIssues(fieldsRef.current, resolveOperators);
		if (issues.duplicatePaths.length > 0) {
			warnFilterOnce(`dup:${issues.duplicatePaths.join(",")}`, `duplicate sibling field ids are ignored after the first: ${issues.duplicatePaths.join(", ")}`);
		}
		if (issues.emptyIds.length > 0) {
			warnFilterOnce("empty-id", "every field needs a non-empty id");
		}
		if (issues.unknownDefaultOperators.length > 0) {
			warnFilterOnce(
				`op:${issues.unknownDefaultOperators.join(",")}`,
				`defaultOperator names an operator the field does not offer: ${issues.unknownDefaultOperators.join(", ")}`,
			);
		}
	}, [signature, resolveOperators]);

	const actions = React.useMemo(
		(): FilterActionsContextValue => ({
			index,
			labels,
			operatorCatalog,
			editors,
			size,
			disabled,
			readOnly,
			variant,
			menuClassName,
			fieldPickerClassName,
			convertToAdvanced: onConvertToAdvanced,
			pathCollapse,
			maxPathSegments,
			resolveOperators,
			resolveEditor,
			resolution: resolutionStore,
			addRule,
			addGroup,
			updateRule,
			removeNode,
			duplicateNode,
			negateRule,
			moveNode,
			moveNodeTo,
			copyNodeTo,
			wrapNodeInGroup,
			unwrapGroup,
			setCombinator,
			toggleCombinator,
			clearQuery,
			openCreate,
			openAmend,
			closeDraft,
			dispatchDraft,
			announce,
			getQuery: current,
			getDraft,
			nextId,
		}),
		[
			index,
			labels,
			operatorCatalog,
			editors,
			size,
			disabled,
			readOnly,
			variant,
			menuClassName,
			fieldPickerClassName,
			onConvertToAdvanced,
			pathCollapse,
			maxPathSegments,
			resolveOperators,
			resolveEditor,
			resolutionStore,
			addRule,
			addGroup,
			updateRule,
			removeNode,
			duplicateNode,
			negateRule,
			moveNode,
			moveNodeTo,
			copyNodeTo,
			wrapNodeInGroup,
			unwrapGroup,
			setCombinator,
			toggleCombinator,
			clearQuery,
			openCreate,
			openAmend,
			closeDraft,
			dispatchDraft,
			announce,
			current,
			getDraft,
			nextId,
		],
	);

	const state = React.useMemo(
		(): FilterStateContextValue => ({ query, draft, ruleCount, announcement: announced.text, announcementSeq: announced.seq }),
		[query, draft, ruleCount, announced],
	);
	const renderContext = React.useMemo((): FilterRenderContextValue => ({ renderValue, renderChip, renderEmpty }), [renderValue, renderChip, renderEmpty]);

	let chrome: React.ReactNode;
	if (children !== undefined) {
		chrome = (
			<div ref={ref} data-slot="filters-root" className={className}>
				{children}
			</div>
		);
	} else if (variant === "advanced") {
		chrome = <FiltersAdvanced ref={ref} mode={advancedMode} align={advancedAlign} trigger={trigger} reorderable={reorderable} className={className} />;
	} else {
		chrome = <FiltersRow ref={ref} trigger={trigger} showClear={showClear} className={className} />;
	}

	return (
		<FilterActionsContext.Provider value={actions}>
			<FilterStateContext.Provider value={state}>
				<FilterRenderContext.Provider value={renderContext}>
					<FilterRowStateProvider value={rowStateStore}>
						<FilterFocusContext.Provider value={focusStore}>{chrome}</FilterFocusContext.Provider>
					</FilterRowStateProvider>
				</FilterRenderContext.Provider>
			</FilterStateContext.Provider>
		</FilterActionsContext.Provider>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Row                                     */
/* -------------------------------------------------------------------------- */

export interface FiltersRowProps {
	readonly trigger?: React.ReactElement | undefined;
	readonly showClear?: boolean | undefined;
	readonly className?: string | undefined;
}

const CHIP_SELECTOR = '[data-slot="filter-chip"]';

/**
 * The chip row: a toolbar with a roving tabindex. There is NO combinator here,
 * because a chip row can draw a word between two pills but not a parenthesis:
 * nested rules are drawn flat.
 */
export const FiltersRow = React.forwardRef<HTMLDivElement, FiltersRowProps>(function FiltersRow({ trigger, showClear = false, className }, ref): React.JSX.Element {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const { query, ruleCount, announcement, announcementSeq } = useFilterState();
	const focusStore = useFilterFocusStore();
	const toolbarRef = React.useRef<HTMLDivElement | null>(null);
	const readOnlyId = React.useId();
	const locked = isFilterLocked(actions);
	const rules = React.useMemo((): readonly FilterRule[] => flattenFilterRules(query), [query]);
	const { moveNode, removeNode, getQuery, resolveOperators, index, clearQuery } = actions;

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (!(event.target instanceof HTMLElement)) {
				return;
			}
			const target = event.target.closest<HTMLElement>(CHIP_SELECTOR);
			// A key pressed inside a segment or an open popover belongs to it.
			if (target === null || event.target !== target) {
				return;
			}
			const chips = Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>(CHIP_SELECTOR) ?? []);
			const position = chips.indexOf(target);
			const ruleId = target.dataset.ruleId;
			if (position === -1 || ruleId === undefined) {
				return;
			}
			const rtl = getComputedStyle(target).direction === "rtl";
			const forward = rtl ? "ArrowLeft" : "ArrowRight";
			const backward = rtl ? "ArrowRight" : "ArrowLeft";
			const focusAt = (next: number): void => {
				const chip = chips[Math.max(0, Math.min(next, chips.length - 1))];
				if (chip !== undefined) {
					event.preventDefault();
					chip.focus();
				}
			};
			if (event.altKey && (event.key === forward || event.key === backward)) {
				event.preventDefault();
				if (!locked) {
					moveNode(ruleId, event.key === forward ? 1 : -1);
				}
				return;
			}
			switch (event.key) {
				case forward:
					focusAt(position + 1);
					return;
				case backward:
					focusAt(position - 1);
					return;
				case "Home":
					focusAt(0);
					return;
				case "End":
					focusAt(chips.length - 1);
					return;
				case "Backspace":
				case "Delete":
					if (locked) {
						return;
					}
					event.preventDefault();
					removeNode(ruleId);
					// The neighbour taking this chip's place, so a run of deletes keeps focus.
					requestAnimationFrame((): void => {
						const remaining = Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>(CHIP_SELECTOR) ?? []);
						remaining[Math.min(position, remaining.length - 1)]?.focus();
					});
					return;
				case "Enter":
				case " ": {
					if (locked) {
						return;
					}
					event.preventDefault();
					// Enter RESUMES the chip: whichever step the flow has not reached.
					const rule = findFilterRule(getQuery(), ruleId);
					const field = rule === null ? undefined : getFilterField(index, rule.path);
					if (rule === null || field === undefined) {
						return;
					}
					const operator = getFilterOperator(resolveOperators(field), rule.operator);
					const segment: FilterFocusSegment = rule.operator !== "" && operatorTakesValue(operator) ? "value" : "operator";
					focusStore.set({ id: ruleId, segment, autoOpen: true });
					return;
				}
				default:
					return;
			}
		},
		[locked, moveNode, removeNode, getQuery, index, resolveOperators, focusStore],
	);

	const handleClear = React.useCallback((): void => {
		clearQuery();
	}, [clearQuery]);

	const barSize = sizes.button === "xs" ? "sm" : "default";
	return (
		<div
			ref={ref}
			data-slot="filters"
			data-empty={rules.length === 0 ? "" : undefined}
			data-readonly={actions.readOnly ? "" : undefined}
			className={cn(filtersVariants({ size: barSize, state: resolveFiltersState(actions.disabled, actions.readOnly) }), rules.length === 0 ? "gap-0" : undefined, className)}>
			{actions.readOnly ? (
				<p id={readOnlyId} className="sr-only">
					{actions.labels.readOnly}
				</p>
			) : null}
			<div
				ref={toolbarRef}
				role="toolbar"
				aria-label={actions.labels.filtersLabel}
				aria-orientation="horizontal"
				aria-describedby={actions.readOnly ? readOnlyId : undefined}
				tabIndex={-1}
				className={filtersVariants({ size: barSize })}
				onKeyDown={handleKeyDown}>
				{rules.map((rule: FilterRule, position: number): React.JSX.Element => (
					<FilterChip key={rule.id} rule={rule} index={position} />
				))}
			</div>
			<FiltersBuilder trigger={trigger} />
			{showClear && ruleCount > 0 ? (
				<Button type="button" variant="outline" size={sizes.button} className="ms-auto" disabled={actions.disabled} {...filterReadOnlyProps(actions)} onClick={handleClear}>
					{actions.labels.clear}
				</Button>
			) : null}
			<div aria-live="polite" role="status" className="sr-only">
				<span key={announcementSeq}>{announcement}</span>
			</div>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Exports                                  */
/* -------------------------------------------------------------------------- */

// The full pure READ surface: one import reaches everything a predicate, a
// saved view or a backend query needs. Nothing compiles to SQL here; a server
// re-validates the tree with the same schema and compiles from it.
export {
	collectFilterIssues,
	copyFilterNodeTo,
	countFilterRules,
	createFilterGroup,
	createFilterQuery,
	createFilterRule,
	FilterQueryParseError,
	flattenFilterConditions,
	flattenFilterRules,
	isFilterQueryEmpty,
	isFilterRuleComplete,
	moveFilterNodeTo,
	parseFilterQuery,
	pruneFilterQuery,
	serializeFilterQuery,
	unwrapFilterGroup,
	wrapFilterNodeInGroup,
} from "./filters-query";
export type { FilterArityResolver, FilterCondition, FilterQueryParseResult, FilterValidateResolver } from "./filters-query";
export {
	filterReadOnlyProps,
	isFilterLocked,
	useFilterActions,
	useFilterChipAutoOpen,
	useFilterChipFocused,
	useFilterFocus,
	useFilterFocusEmpty,
	useFilterFocusStore,
	useFilterRender,
	useFilterSegmentFocus,
	useFilterState,
} from "./filters-context";
export { FilterChip, FilterOperatorPopover, FilterRuleMenuItems, FilterValuePopover, useFilterRuleDisplay } from "./filters-chip";
export { FilterAdvancedRow, FiltersAdvanced, FiltersAdvancedPanel } from "./filters-advanced";
export { FilterFieldPicker, FiltersBuilder } from "./filters-builder";
export { createFilterOperators, FILTER_OPERATOR_CATALOG } from "./filters-operators";
export { DEFAULT_FILTER_EDITORS, useFilterOptions, useFilterValueResolution } from "./filters-editors";
export { FilterQuerySchema, FilterRuleSchema, FilterValueSchema } from "./filters-types";
export type * from "./filters-types";
