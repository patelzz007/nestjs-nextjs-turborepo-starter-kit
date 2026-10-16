"use client";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { isBooleanPrimitive } from "@workspace/shared";
import { cva } from "class-variance-authority";
import { ArrowLeftRightIcon, ChevronRightIcon, CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, LayersIcon, SlidersHorizontalIcon, Trash2Icon, XIcon } from "lucide-react";
import * as React from "react";

import {
	filterControlSizes,
	filterReadOnlyProps,
	isFilterLocked,
	useFilterActions,
	useFilterChipFocused,
	useFilterFocusEmpty,
	useFilterFocusStore,
	useFilterRender,
	useFilterReorderable,
	type FilterFocusSegment,
	type FilterFocusStore,
} from "./filters-context";
import { formatFilterDate } from "./filters-date";
import { FilterMenu, filterOptionValues, findFilterAutoFocusTarget, useFilterOptions, useFilterValueResolution, type FilterListItem } from "./filters-editors";
import { collapseFilterPath, FILTER_MENU_CLASS, FILTER_MENU_LABEL_CLASS, formatFilterPath, getFilterField, getFilterFieldChain, type FilterPathSegment } from "./filters-lib";
import { coerceFilterValue, getFilterArity, getFilterOperator, operatorTakesValue, visibleFilterOperators } from "./filters-operators";
import { findFilterNode, isFilterGroup } from "./filters-query";
import {
	FILTER_AUTOFOCUS_PROPS,
	filterValueItems,
	isFilterDateValue,
	type FilterCommitOptions,
	type FilterEditorProps,
	type FilterField,
	type FilterGroupNode,
	type FilterLabels,
	type FilterOperator,
	type FilterOption,
	type FilterRule,
	type FilterValue,
	type FilterValueDisplayContext,
	type FilterValueItem,
} from "./filters-types";

/* -------------------------------------------------------------------------- */
/*                                 Auto-open                                  */
/* -------------------------------------------------------------------------- */

function isOpenRequested(store: FilterFocusStore, id: string, segment: FilterFocusSegment): boolean {
	const snapshot = store.getSnapshot();
	return snapshot.autoOpen && snapshot.id === id && snapshot.segment === segment;
}

/**
 * A popover the focus store can open: the root asks for it (`autoOpen`) when a
 * chip is created or a flow hands on a step. The request is CONSUMED as it is
 * honoured, so Escape closing the panel never reopens it. Refused while locked.
 */
export function useFilterAutoOpenSegment(id: string, segment: FilterFocusSegment, locked: boolean): readonly [boolean, (next: boolean) => void] {
	const store = useFilterFocusStore();
	const [open, setOpen] = React.useState((): boolean => !locked && isOpenRequested(store, id, segment));
	React.useEffect((): (() => void) => {
		const consume = (): void => {
			if (!isOpenRequested(store, id, segment)) {
				return;
			}
			store.set({ id, segment, autoOpen: false });
			if (!locked) {
				setOpen(true);
			}
		};
		const unsubscribe = store.subscribe(consume);
		if (isOpenRequested(store, id, segment)) {
			store.set({ id, segment, autoOpen: false });
		}
		return unsubscribe;
	}, [store, id, segment, locked]);
	return [open, setOpen];
}

/* -------------------------------------------------------------------------- */
/*                                  Display                                   */
/* -------------------------------------------------------------------------- */

/** The reference day for parsing a stored absolute date; a full `yyyy-MM-dd` never reads it. */
const DATE_REFERENCE = new Date(0);

function itemText(item: FilterValueItem, labels: FilterLabels, resolveOption: (value: string) => FilterOption | undefined): string {
	if (item === null) {
		return "";
	}
	if (isFilterDateValue(item)) {
		return formatFilterDate(item, labels, DATE_REFERENCE);
	}
	if (isBooleanPrimitive(item)) {
		return item ? labels.booleanTrue : labels.booleanFalse;
	}
	const text = String(item);
	return resolveOption(text)?.label ?? text;
}

function isEmptyValue(value: FilterValue | undefined): boolean {
	return value === undefined || value === "" || filterValueItems(value).length === 0;
}

/** The built-in plain-text reading of a value. */
export function defaultFilterValueText(
	value: FilterValue | undefined,
	operator: FilterOperator | undefined,
	resolveOption: (value: string) => FilterOption | undefined,
	labels: FilterLabels,
	fieldPlaceholder: string | undefined,
	optionBacked: boolean,
): string {
	const emptyLabel = optionBacked ? labels.selectPlaceholder : (fieldPlaceholder ?? labels.valuePlaceholder);
	if (isEmptyValue(value)) {
		return emptyLabel;
	}
	const items = filterValueItems(value);
	if (getFilterArity(operator) === "range") {
		const [from = null, to = null] = items;
		return labels.valueRange(itemText(from, labels, resolveOption), itemText(to, labels, resolveOption));
	}
	const [first = null] = items;
	if (items.length === 1) {
		return itemText(first, labels, resolveOption);
	}
	return labels.valueCount(items.length);
}

function isOptionBacked(field: FilterField): boolean {
	return field.type === "select" || field.type === "multiselect" || (field.options?.length ?? 0) > 0 || field.loadOptions !== undefined;
}

/** The glyph between two ancestors in a nested attribute path. DECORATIVE. */
function FilterPathSeparator(): React.JSX.Element {
	return (
		<ChevronRightIcon aria-hidden="true" data-slot="filter-path-separator" className="mx-0.5 inline-block size-3 shrink-0 self-center text-muted-foreground rtl:rotate-180" />
	);
}

const PATH_ELLIPSIS_TRIGGER = <span aria-hidden="true" data-slot="filter-path-ellipsis" className="shrink-0 self-center text-muted-foreground" />;
/** The visible mark of an elided run; the full path stays in the control's NAME. */
const PATH_ELLIPSIS_GLYPH = "…";

/** The elided run of a collapsed path, with the FULL path behind a tooltip. */
function FilterPathEllipsis({ full }: { readonly full: string }): React.JSX.Element {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger render={PATH_ELLIPSIS_TRIGGER}>{PATH_ELLIPSIS_GLYPH}</TooltipTrigger>
				<TooltipContent>{full}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/** Everything a rule needs in order to be READ, in either chrome. */
export interface FilterRuleDisplay {
	readonly pathText: string;
	readonly pathLabel: React.ReactNode;
	/** Whether `pathLabel` shows fewer names than the path has. */
	readonly pathCollapsed: boolean;
	readonly operatorLabel: string;
	readonly valueLabel: React.ReactNode;
	/** The same value as PLAIN TEXT, for an accessible name. */
	readonly valueText: string;
	/** The same value with any collapsed COUNT spelled out. */
	readonly valueFullText: string;
	readonly valueEmpty: boolean;
}

function segmentKey(segment: FilterPathSegment, index: number): string {
	return segment.type === "field" ? `${String(index)}:${segment.field.id}` : `${String(index)}:ellipsis`;
}

/**
 * How one rule reads, resolved once and shared by both chromes, so a consumer
 * `renderValue`, the field's own and the built-in cannot disagree.
 */
export function useFilterRuleDisplay(rule: FilterRule, field: FilterField | undefined, operator: FilterOperator | undefined): FilterRuleDisplay {
	const actions = useFilterActions();
	const render = useFilterRender();
	// Lazily: a label needs no options until an editor actually opens.
	const optionsState = useFilterOptions(field, false);
	const values = filterValueItems(rule.value);
	const optionValues = React.useMemo((): readonly string[] => filterOptionValues(rule.value), [rule.value]);
	useFilterValueResolution(field, optionValues);

	const { labels } = actions;
	const pathText = formatFilterPath(actions.index, rule.path, labels.pathSeparator);
	const chain = getFilterFieldChain(actions.index, rule.path);
	const segments = collapseFilterPath(chain, { maxSegments: actions.maxPathSegments, collapse: actions.pathCollapse });
	const pathCollapsed = segments.some((segment: FilterPathSegment): boolean => segment.type === "ellipsis");
	const pathLabel: React.ReactNode =
		chain.length === 0
			? pathText
			: segments.map((segment: FilterPathSegment, index: number): React.JSX.Element => (
					<React.Fragment key={segmentKey(segment, index)}>
						{index > 0 ? <FilterPathSeparator /> : null}
						{segment.type === "field" ? <span>{segment.field.label}</span> : <FilterPathEllipsis full={pathText} />}
					</React.Fragment>
				));

	const operatorLabel =
		operator === undefined ? (rule.operator === "" ? labels.selectCondition : rule.operator) : rule.negated === true ? labels.negated(operator.label) : operator.label;
	const valueEmpty = isEmptyValue(rule.value);

	if (field === undefined) {
		return { pathText, pathLabel, pathCollapsed, operatorLabel, valueLabel: "", valueText: "", valueFullText: "", valueEmpty };
	}

	const context: FilterValueDisplayContext = {
		value: rule.value,
		values,
		field,
		operator: operator ?? { value: rule.operator, label: rule.operator },
		options: optionValues.map(optionsState.resolve).filter((option: FilterOption | undefined): option is FilterOption => option !== undefined),
		labels,
	};

	const valueText = field.valueText?.(context) ?? defaultFilterValueText(rule.value, operator, optionsState.resolve, labels, field.placeholder, isOptionBacked(field));
	const [single] = optionValues;
	const icon = optionValues.length === 1 && single !== undefined ? optionsState.resolve(single)?.icon : undefined;
	const builtInLabel: React.ReactNode =
		icon === undefined || icon === null ? (
			valueText
		) : (
			<span className="flex items-center gap-1.5">
				{icon}
				{valueText}
			</span>
		);
	const valueLabel = render.renderValue?.(context) ?? field.renderValue?.(context) ?? builtInLabel;
	const valueFullText =
		field.valueText !== undefined || getFilterArity(operator) === "range" || values.length < 2
			? valueText
			: labels.valueDetail(
					valueText,
					values.map((item: FilterValueItem): string => itemText(item, labels, optionsState.resolve)),
				);

	return { pathText, pathLabel, pathCollapsed, operatorLabel, valueLabel, valueText, valueFullText, valueEmpty };
}

/* -------------------------------------------------------------------------- */
/*                                Value editor                                */
/* -------------------------------------------------------------------------- */

interface FilterValueEditorProps {
	readonly rule: FilterRule;
	readonly field: FilterField;
	readonly operator: FilterOperator;
	readonly onClose: () => void;
}

/**
 * The value editor - draft, option service, commit - with NO surface of its
 * own. Mounted only while its popover is open, so the draft starts from the
 * committed value every time, and a text filter dispatches once on commit.
 */
function FilterValueEditor({ rule, field, operator, onClose }: FilterValueEditorProps): React.JSX.Element | null {
	const actions = useFilterActions();
	const [draft, setDraft] = React.useState<FilterValue | undefined>(rule.value);
	const options = useFilterOptions(field, true);
	const Editor = React.useMemo(() => actions.resolveEditor(field, operator), [actions, field, operator]);
	const { updateRule } = actions;
	const ruleId = rule.id;

	const commit = React.useCallback(
		(next?: FilterValue, commitOptions?: FilterCommitOptions): void => {
			updateRule(ruleId, { value: next ?? draft });
			if (commitOptions?.close !== false) {
				onClose();
			}
		},
		[updateRule, ruleId, draft, onClose],
	);

	if (Editor === undefined) {
		return null;
	}
	const editorProps: FilterEditorProps = {
		field,
		operator,
		value: draft,
		onValueChange: setDraft,
		host: "amend",
		autoFocusProps: FILTER_AUTOFOCUS_PROPS,
		commit,
		cancel: onClose,
		back: onClose,
		options,
		labels: actions.labels,
	};
	// A LOOKUP, not a definition: the component is a module-level built-in or the
	// consumer's own, so it is never remounted mid-edit.
	return React.createElement(Editor, editorProps);
}

/** Focus the editor's marked element as a panel opens, else the popover's default. */
function useAutoFocusTarget(): readonly [React.RefObject<HTMLDivElement | null>, () => HTMLElement | boolean] {
	const panelRef = React.useRef<HTMLDivElement | null>(null);
	const initialFocus = React.useCallback((): HTMLElement | boolean => findFilterAutoFocusTarget(panelRef.current) ?? true, []);
	return [panelRef, initialFocus];
}

export interface FilterValuePopoverProps {
	readonly rule: FilterRule;
	readonly field: FilterField;
	readonly operator: FilterOperator | undefined;
	/** The element that opens it, WITH its own children: a chip segment must be a direct child of its `ButtonGroup`. */
	readonly trigger: React.ReactElement;
	readonly className?: string | undefined;
}

/** The value host: the editor in a popover anchored to the value segment. The ref reaches the panel. */
export const FilterValuePopover = React.forwardRef<HTMLDivElement, FilterValuePopoverProps>(function FilterValuePopover(
	{ rule, field, operator, trigger, className },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	const focusStore = useFilterFocusStore();
	const locked = isFilterLocked(actions);
	const [open, setOpen] = useFilterAutoOpenSegment(rule.id, "value", locked);
	const [panelRef, initialFocus] = useAutoFocusTarget();
	const setPanelRef = React.useMemo(() => mergeRefs(panelRef, ref), [panelRef, ref]);
	const ruleId = rule.id;

	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next && locked) {
				return;
			}
			setOpen(next);
		},
		[locked, setOpen],
	);
	const handleClose = React.useCallback((): void => {
		setOpen(false);
		focusStore.set({ id: ruleId, segment: "value", autoOpen: false });
	}, [setOpen, focusStore, ruleId]);

	const hasEditor = operator !== undefined && actions.resolveEditor(field, operator) !== undefined;
	return (
		<Popover open={hasEditor ? open : false} onOpenChange={handleOpenChange}>
			<PopoverTrigger render={trigger} disabled={actions.disabled || !hasEditor} {...filterReadOnlyProps(actions)} />
			<PopoverContent ref={setPanelRef} align="start" initialFocus={initialFocus} className={cn("w-auto gap-0 p-0", className)}>
				{operator === undefined ? null : <FilterValueEditor rule={rule} field={field} operator={operator} onClose={handleClose} />}
			</PopoverContent>
		</Popover>
	);
});

/* -------------------------------------------------------------------------- */
/*                               Operator menu                                */
/* -------------------------------------------------------------------------- */

/** The operator menu's list height: the set is CLOSED, so it buys the whole catalog. */
const OPERATOR_MENU_MAX_HEIGHT = 320;

export interface FilterOperatorPopoverProps {
	readonly rule: FilterRule;
	readonly field: FilterField;
	readonly trigger: React.ReactElement;
	readonly className?: string | undefined;
}

/**
 * The condition menu. While a rule is being BUILT (no operator yet) choosing a
 * condition that takes a value HANDS OFF to the value popover once this panel
 * has closed; re-picking on a finished rule just commits and closes.
 */
export const FilterOperatorPopover = React.forwardRef<HTMLDivElement, FilterOperatorPopoverProps>(function FilterOperatorPopover(
	{ rule, field, trigger, className },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	const focusStore = useFilterFocusStore();
	const locked = isFilterLocked(actions);
	const [open, setOpen] = useFilterAutoOpenSegment(rule.id, "operator", locked);
	const handoff = React.useRef(false);
	const operators = actions.resolveOperators(field);
	const items = React.useMemo(
		(): readonly FilterListItem[] => visibleFilterOperators(operators).map((entry: FilterOperator): FilterListItem => ({ value: entry.value, label: entry.label })),
		[operators],
	);
	const selected = React.useMemo((): readonly string[] => (rule.operator === "" ? [] : [rule.operator]), [rule.operator]);
	const { updateRule } = actions;
	const ruleId = rule.id;
	const ruleOperator = rule.operator;
	const ruleValue = rule.value;

	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next && locked) {
				return;
			}
			// Escape, an outside press, a second press: none is the step being taken.
			if (next) {
				handoff.current = false;
			}
			setOpen(next);
		},
		[locked, setOpen],
	);

	const handleOpenChangeComplete = React.useCallback(
		(next: boolean): void => {
			if (next || !handoff.current) {
				return;
			}
			handoff.current = false;
			focusStore.set({ id: ruleId, segment: "value", autoOpen: true });
		},
		[focusStore, ruleId],
	);

	// Focus returns to the trigger, unless the next step is taking it.
	const finalFocus = React.useCallback((): boolean => !handoff.current, []);

	const handleSelectionChange = React.useCallback(
		(values: readonly string[]): void => {
			const [value] = values;
			if (value === undefined) {
				setOpen(false);
				return;
			}
			const chosen = getFilterOperator(operators, value);
			const building = ruleOperator === "";
			updateRule(ruleId, { operator: value, value: coerceFilterValue(ruleValue, getFilterOperator(operators, ruleOperator), chosen) });
			handoff.current = building && operatorTakesValue(chosen);
			setOpen(false);
		},
		[operators, ruleOperator, ruleValue, ruleId, updateRule, setOpen],
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange} onOpenChangeComplete={handleOpenChangeComplete}>
			<PopoverTrigger render={trigger} disabled={actions.disabled} {...filterReadOnlyProps(actions)} />
			<PopoverContent ref={ref} align="start" finalFocus={finalFocus} className={cn("w-auto min-w-40 gap-0 p-0", className)}>
				<FilterMenu
					items={items}
					selected={selected}
					onSelectionChange={handleSelectionChange}
					labels={actions.labels}
					ariaLabel={field.label}
					searchPlaceholder={actions.labels.searchOperators}
					searchable={false}
					maxHeight={OPERATOR_MENU_MAX_HEIGHT}
				/>
			</PopoverContent>
		</Popover>
	);
});

/* -------------------------------------------------------------------------- */
/*                                 Menu items                                 */
/* -------------------------------------------------------------------------- */

interface RuleMenuItemProps {
	readonly nodeId: string;
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly disabled: boolean;
	readonly destructive?: boolean | undefined;
	readonly onAction: (nodeId: string) => void;
}

function RuleMenuItem({ nodeId, icon, label, disabled, destructive = false, onAction }: RuleMenuItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onAction(nodeId);
	}, [onAction, nodeId]);
	return (
		<DropdownMenuItem variant={destructive ? "destructive" : "default"} disabled={disabled} onClick={handleClick}>
			{icon}
			<span className={FILTER_MENU_LABEL_CLASS}>{label}</span>
		</DropdownMenuItem>
	);
}

interface MoveDestination {
	readonly id: string;
	readonly label: string;
	readonly size: number;
}

/** The groups a node may move into, numbered in document order. */
export function filterMoveDestinations(query: FilterGroupNode, nodeId: string, labels: Pick<FilterLabels, "moveToTopLevel" | "moveToGroup">): readonly MoveDestination[] {
	const found = findFilterNode(query, nodeId);
	const parentId = found?.parent?.id;
	if (parentId === undefined) {
		return [];
	}
	const destinations: MoveDestination[] = [];
	if (parentId !== query.id) {
		destinations.push({ id: query.id, label: labels.moveToTopLevel, size: query.rules.length });
	}
	let position = 0;
	const visit = (group: FilterGroupNode, inside: boolean): void => {
		for (const child of group.rules) {
			if (!isFilterGroup(child)) {
				continue;
			}
			position += 1;
			// Itself and everything under it would leave a cycle, so never offered.
			const within = inside || child.id === nodeId;
			if (!within && child.id !== parentId) {
				destinations.push({ id: child.id, label: labels.moveToGroup(position), size: child.rules.length });
			}
			visit(child, within);
		}
	};
	visit(query, false);
	return destinations;
}

interface MoveToMenuItemProps {
	readonly nodeId: string;
	readonly destination: MoveDestination;
	readonly disabled: boolean;
	readonly onMove: (nodeId: string, parentId: string, index: number) => void;
}

function MoveToMenuItem({ nodeId, destination, disabled, onMove }: MoveToMenuItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onMove(nodeId, destination.id, destination.size);
	}, [onMove, nodeId, destination]);
	return (
		<DropdownMenuItem disabled={disabled} onClick={handleClick}>
			<CornerDownRightIcon aria-hidden="true" />
			<span className={FILTER_MENU_LABEL_CLASS}>{destination.label}</span>
		</DropdownMenuItem>
	);
}

export interface FilterMoveToMenuItemsProps {
	readonly nodeId: string;
}

/** The keyboard path to a CROSS-GROUP move. Gated on the same switch as the grip. */
export const FilterMoveToMenuItems = React.forwardRef<HTMLDivElement, FilterMoveToMenuItemsProps>(function FilterMoveToMenuItems({ nodeId }, ref): React.JSX.Element | null {
	const actions = useFilterActions();
	const reorderable = useFilterReorderable();
	const locked = isFilterLocked(actions);
	// Read at render time: the menu content mounts when the menu opens.
	const destinations = filterMoveDestinations(actions.getQuery(), nodeId, actions.labels);
	if (!reorderable || destinations.length === 0) {
		return null;
	}
	return (
		<DropdownMenuGroup ref={ref}>
			{destinations.map((destination: MoveDestination): React.JSX.Element => (
				<MoveToMenuItem key={destination.id} nodeId={nodeId} destination={destination} disabled={locked} onMove={actions.moveNodeTo} />
			))}
		</DropdownMenuGroup>
	);
});

export interface FilterRuleMenuItemsProps {
	readonly ruleId: string;
	/** Offer "Wrap in group" and "Move to". Off for the chip row, which cannot draw a group. */
	readonly allowGrouping?: boolean | undefined;
}

/** The per-rule actions, without the trigger: the chip's kebab and a builder row's kebab act on the same rule. */
export const FilterRuleMenuItems = React.forwardRef<HTMLDivElement, FilterRuleMenuItemsProps>(function FilterRuleMenuItems(
	{ ruleId, allowGrouping = false },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	// Gated here as well as at the trigger: this is EXPORTED.
	const locked = isFilterLocked(actions);
	const { labels, convertToAdvanced } = actions;
	const handleConvert = React.useCallback((): void => {
		convertToAdvanced?.();
	}, [convertToAdvanced]);
	return (
		<DropdownMenuGroup ref={ref}>
			<RuleMenuItem nodeId={ruleId} icon={<CopyIcon aria-hidden="true" />} label={labels.duplicate} disabled={locked} onAction={actions.duplicateNode} />
			<RuleMenuItem nodeId={ruleId} icon={<ArrowLeftRightIcon aria-hidden="true" />} label={labels.negate} disabled={locked} onAction={actions.negateRule} />
			{allowGrouping ? (
				<RuleMenuItem nodeId={ruleId} icon={<LayersIcon aria-hidden="true" />} label={labels.wrapInGroup} disabled={locked} onAction={actions.wrapNodeInGroup} />
			) : null}
			{allowGrouping ? <FilterMoveToMenuItems nodeId={ruleId} /> : null}
			{convertToAdvanced !== undefined && actions.variant !== "advanced" ? (
				<DropdownMenuItem onClick={handleConvert}>
					<SlidersHorizontalIcon aria-hidden="true" />
					<span className={FILTER_MENU_LABEL_CLASS}>{labels.convertToAdvanced}</span>
				</DropdownMenuItem>
			) : null}
			<RuleMenuItem nodeId={ruleId} icon={<Trash2Icon aria-hidden="true" />} label={labels.remove} disabled={locked} destructive onAction={actions.removeNode} />
		</DropdownMenuGroup>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Chip                                    */
/* -------------------------------------------------------------------------- */

export const filterChipVariants = cva("rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-focused:ring-3 data-focused:ring-ring/30", {
	variants: {
		size: { sm: "text-xs", default: "text-sm" },
		state: {
			default: "",
			incomplete: "[&>[data-slot=button-group-text]]:border-dashed",
			unknown: "opacity-70",
			disabled: "pointer-events-none opacity-50",
		},
	},
	defaultVariants: { size: "default", state: "default" },
});

/** A chip segment: a ButtonGroupText rendered as a button. */
const SEGMENT_BUTTON = <button type="button" />;
const SEGMENT_CLASS = "cursor-default bg-background hover:bg-muted dark:bg-input/30";

export interface FilterChipProps {
	readonly rule: FilterRule;
	readonly index: number;
	readonly className?: string | undefined;
}

/**
 * One filter, as a chip: attribute (display only), condition, value and a
 * menu. Exactly one chip is in the tab order; its segments are tabbable only
 * while it holds that stop, so arrows walk chips and Tab walks segments.
 */
export const FilterChip = React.memo(
	React.forwardRef<HTMLDivElement, FilterChipProps>(function FilterChip({ rule, index, className }, ref): React.JSX.Element {
		const actions = useFilterActions();
		const render = useFilterRender();
		const focusStore = useFilterFocusStore();
		const focused = useFilterChipFocused(rule.id);
		const noFocus = useFilterFocusEmpty();
		const locked = isFilterLocked(actions);
		const sizes = filterControlSizes(actions);
		const [menuOpen, setMenuOpen] = React.useState(false);
		const isTabStop = focused || (noFocus && index === 0);
		const segmentTabIndex = isTabStop ? 0 : -1;

		const field = getFilterField(actions.index, rule.path);
		const operators = field === undefined ? [] : actions.resolveOperators(field);
		const operator = getFilterOperator(operators, rule.operator);
		const display = useFilterRuleDisplay(rule, field, operator);
		const ruleId = rule.id;

		const handleFocusCapture = React.useCallback((): void => {
			if (focusStore.getSnapshot().id === ruleId) {
				return;
			}
			focusStore.set({ id: ruleId, segment: null, autoOpen: false });
		}, [focusStore, ruleId]);
		const handleMenuOpenChange = React.useCallback(
			(next: boolean): void => {
				if (next && locked) {
					return;
				}
				setMenuOpen(next);
			},
			[locked],
		);
		const handleRemove = React.useCallback((): void => {
			actions.removeNode(ruleId);
		}, [actions, ruleId]);

		if (field === undefined) {
			// A rule pointing at a field the schema no longer has: kept visible (it
			// still filters) and removable, never silently dropped.
			const unknownPath = rule.path.join(actions.labels.pathSeparator);
			return (
				<ButtonGroup
					ref={ref}
					data-slot="filter-chip"
					data-unknown=""
					aria-label={actions.labels.filterLabel(unknownPath)}
					data-focused={focused ? "" : undefined}
					data-rule-id={rule.id}
					data-index={index}
					tabIndex={isTabStop ? 0 : -1}
					onFocusCapture={handleFocusCapture}
					className={cn(filterChipVariants({ size: actions.size, state: "unknown" }), className)}>
					<ButtonGroupText className="bg-background text-muted-foreground dark:bg-input/30">{unknownPath}</ButtonGroupText>
					<Button
						variant="outline"
						size={sizes.icon}
						tabIndex={segmentTabIndex}
						aria-label={actions.labels.remove}
						disabled={actions.disabled}
						{...filterReadOnlyProps(actions)}
						onClick={handleRemove}>
						<XIcon aria-hidden="true" />
					</Button>
				</ButtonGroup>
			);
		}

		const custom = render.renderChip?.(rule);
		if (custom !== undefined) {
			return <>{custom}</>;
		}

		const incomplete = rule.operator === "";
		const hasValue = !incomplete && operatorTakesValue(operator);
		const valueName = display.valueEmpty && field.valueText === undefined ? actions.labels.noValue : display.valueText;
		const condition = `${display.pathText} ${display.operatorLabel}${hasValue ? ` ${valueName}` : ""}`.trim();
		const chipState = actions.disabled ? "disabled" : incomplete ? "incomplete" : "default";

		return (
			<ButtonGroup
				ref={ref}
				data-slot="filter-chip"
				aria-label={actions.labels.filterLabel(incomplete ? `${condition}, ${actions.labels.incomplete}` : condition)}
				data-focused={focused ? "" : undefined}
				data-incomplete={incomplete ? "" : undefined}
				data-rule-id={rule.id}
				data-index={index}
				tabIndex={isTabStop ? 0 : -1}
				onFocusCapture={handleFocusCapture}
				className={cn(filterChipVariants({ size: actions.size, state: chipState }), className)}>
				<ButtonGroupText title={display.pathCollapsed ? undefined : display.pathText} className="cursor-default gap-1.5 bg-background dark:bg-input/30">
					{field.icon}
					<span className="flex items-center">{display.pathLabel}</span>
				</ButtonGroupText>
				<FilterOperatorPopover
					rule={rule}
					field={field}
					trigger={
						<ButtonGroupText
							render={SEGMENT_BUTTON}
							tabIndex={segmentTabIndex}
							data-segment="operator"
							className={cn(SEGMENT_CLASS, incomplete ? "text-foreground" : "text-muted-foreground")}>
							{display.operatorLabel}
						</ButtonGroupText>
					}
				/>
				{hasValue ? (
					<FilterValuePopover
						rule={rule}
						field={field}
						operator={operator}
						trigger={
							<ButtonGroupText
								render={SEGMENT_BUTTON}
								tabIndex={segmentTabIndex}
								data-segment="value"
								aria-label={locked ? display.valueFullText : display.valueText}
								title={display.valueFullText === display.valueText ? undefined : display.valueFullText}
								className={cn(SEGMENT_CLASS, display.valueEmpty ? "text-muted-foreground" : undefined)}>
								{display.valueLabel}
							</ButtonGroupText>
						}
					/>
				) : null}
				<DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
					<DropdownMenuTrigger
						disabled={actions.disabled}
						{...filterReadOnlyProps(actions)}
						render={
							<Button
								variant="outline"
								size={sizes.icon}
								tabIndex={segmentTabIndex}
								className="bg-background dark:bg-input/30"
								aria-label={actions.labels.chipMenu(field.label)}
							/>
						}>
						<EllipsisVerticalIcon aria-hidden="true" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className={cn(FILTER_MENU_CLASS, actions.menuClassName)}>
						<FilterRuleMenuItems ruleId={rule.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
		);
	}),
);
