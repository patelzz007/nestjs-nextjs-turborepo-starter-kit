"use client";

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronDownIcon, EllipsisVerticalIcon, GripVerticalIcon, ListFilterIcon, PlusIcon, Trash2Icon, UngroupIcon } from "lucide-react";
import * as React from "react";

import { FilterFieldPicker } from "./filters-builder";
import { FilterMoveToMenuItems, FilterOperatorPopover, FilterRuleMenuItems, FilterValuePopover, useFilterAutoOpenSegment, useFilterRuleDisplay } from "./filters-chip";
import {
	filterControlSizes,
	filterReadOnlyProps,
	FilterReorderProvider,
	isFilterLocked,
	useFilterActions,
	useFilterFocusStore,
	useFilterRender,
	useFilterReorderable,
	useFilterRowPending,
	useFilterRowStateStore,
	useFilterTouchedIds,
	useFilterState,
	type FilterActionsContextValue,
} from "./filters-context";
import { FILTER_ROW_SELECTOR, useFilterRowDrag, type FilterDropDetails, type FilterRowDragHandleProps } from "./filters-dnd";
import { filterIssueLabel } from "./filters-i18n";
import {
	FILTER_FIELD_PICKER_CLASS,
	FILTER_MENU_CLASS,
	FILTER_MENU_LABEL_CLASS,
	filterCombinatorSlot,
	getFilterField,
	isFilterFieldPickable,
	isSameFilterPath,
} from "./filters-lib";
import { getFilterArity, getFilterOperator, operatorTakesValue } from "./filters-operators";
import { collectFilterIssues, createFilterRule, isFilterRule } from "./filters-query";
import { filterValueItems } from "./filters-types";
import type {
	FilterAdvancedMode,
	FilterCombinator,
	FilterEmptyStateContext,
	FilterGroupNode,
	FilterIndexEntry,
	FilterIssue,
	FilterIssueColumn,
	FilterNode,
	FilterOperatorArity,
	FilterQuery,
	FilterRule,
} from "./filters-types";

/* -------------------------------------------------------------------------- */
/*                                  Contexts                                  */
/* -------------------------------------------------------------------------- */

/** Hands every row's handle its pointer wiring: only the panel can measure a drop. */
const FilterDragContext = React.createContext<((nodeId: string) => FilterRowDragHandleProps) | null>(null);

const NO_ISSUES: ReadonlyMap<string, FilterIssue> = new Map<string, FilterIssue>();

/** What each node is missing, by id, already filtered to what may be SHOWN. */
const FilterIssueContext = React.createContext<ReadonlyMap<string, FilterIssue>>(NO_ISSUES);

/** Marks a focusable cell control, read by the keyboard walker. */
const CELL_ATTRIBUTE = "data-filter-cell";

/** Where a row sits, which every cell and the drag layer read. */
export interface FilterRowPosition {
	readonly index: number;
	readonly parentId: string;
	readonly combinator: FilterCombinator;
	/** One-based nesting depth: top-level rows are depth 1. */
	readonly depth: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

export const filtersAdvancedPanelVariants = cva("flex w-full min-w-0 flex-col gap-2", {
	variants: {
		mode: { popover: "p-3", inline: "p-0" },
		state: { default: "", disabled: "pointer-events-none opacity-50", readonly: "" },
	},
	defaultVariants: { mode: "popover", state: "default" },
});

export const filterAdvancedRowVariants = cva(
	"group/row relative flex min-w-0 items-center gap-1.5 rounded-md data-dragging:opacity-60 data-drop-edge:after:absolute data-drop-edge:after:start-0 data-drop-edge:after:end-1 data-drop-edge:after:z-sticky data-drop-edge:after:h-0.5 data-drop-edge:after:rounded-full data-drop-edge:after:bg-primary data-[drop-edge=after]:after:top-full data-[drop-edge=after]:after:mt-1 data-[drop-edge=before]:after:bottom-full data-[drop-edge=before]:after:mb-1",
	{
		variants: {
			kind: { rule: "", group: "items-start" },
			state: { default: "", invalid: "" },
		},
		defaultVariants: { kind: "rule", state: "default" },
	},
);

const CELL_CLASS = "w-full min-w-0 justify-between gap-1.5 font-normal [&>svg]:text-muted-foreground data-invalid:ring-1 data-invalid:ring-destructive/40";
const COMBINATOR_BOX_CLASS = "flex w-16 shrink-0 items-center justify-center";
const COMBINATOR_TEXT_CLASS = "w-full truncate px-1 text-center text-sm text-muted-foreground";
const GROUP_CARD_CLASS =
	"flex min-w-0 flex-1 flex-col gap-3 rounded-md bg-muted/40 py-2 ps-2 inset-ring inset-ring-border data-invalid:inset-ring-destructive/50 data-drop-into:bg-muted/60 data-drop-into:outline-1 data-drop-into:-outline-offset-2 data-drop-into:outline-border";

/** The column every cell button carries, so the keyboard walker can move by name. */
function cellProps(column: string): Readonly<Record<typeof CELL_ATTRIBUTE, string>> {
	return { [CELL_ATTRIBUTE]: column };
}

type IssueProps = Pick<React.AriaAttributes, "aria-invalid" | "aria-description"> & Readonly<Record<"data-invalid", true | undefined>>;

const NO_ISSUE_PROPS: IssueProps = { "aria-invalid": undefined, "aria-description": undefined, "data-invalid": undefined };

function issueProps(issue: FilterIssue | undefined, column: FilterIssueColumn, message: string): IssueProps {
	if (issue?.column !== column) {
		return NO_ISSUE_PROPS;
	}
	return { "aria-invalid": true, "aria-description": message, "data-invalid": true };
}

/* -------------------------------------------------------------------------- */
/*                                Shared cells                                */
/* -------------------------------------------------------------------------- */

interface CombinatorCellProps {
	readonly index: number;
	readonly parentId: string;
	readonly combinator: FilterCombinator;
}

/** The leading and/or slot: one group is joined by ONE operator, so only one slot toggles. */
function CombinatorCell({ index, parentId, combinator }: CombinatorCellProps): React.JSX.Element {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const slot = filterCombinatorSlot(index);
	const word = combinator === "and" ? actions.labels.and : actions.labels.or;
	const { toggleCombinator } = actions;
	const handleClick = React.useCallback((): void => {
		toggleCombinator(parentId);
	}, [toggleCombinator, parentId]);
	if (slot !== "toggle") {
		return <span className={COMBINATOR_TEXT_CLASS}>{slot === "where" ? actions.labels.where : word}</span>;
	}
	const name = actions.labels.combinatorLabel(word);
	return (
		<Button
			type="button"
			variant="outline"
			size={sizes.button}
			aria-label={name}
			title={name}
			disabled={actions.disabled}
			{...filterReadOnlyProps(actions)}
			{...cellProps("combinator")}
			className="w-full min-w-0 justify-center px-1.5 font-normal"
			onClick={handleClick}>
			<span className="truncate">{word}</span>
		</Button>
	);
}

interface DragHandleProps {
	readonly nodeId: string;
	readonly label: string;
}

function DragHandle({ nodeId, label }: DragHandleProps): React.JSX.Element | null {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const drag = React.useContext(FilterDragContext);
	const handleProps = React.useMemo((): FilterRowDragHandleProps | null => drag?.(nodeId) ?? null, [drag, nodeId]);
	if (handleProps === null) {
		return null;
	}
	return (
		<Button
			type="button"
			variant="ghost"
			size={sizes.icon}
			aria-label={`${actions.labels.reorder}, ${label}`}
			aria-description={actions.labels.reorderHint}
			disabled={actions.disabled}
			{...filterReadOnlyProps(actions)}
			{...cellProps("drag")}
			data-slot="filter-drag-handle"
			className="cursor-grab touch-none text-muted-foreground"
			onPointerDown={handleProps.onPointerDown}>
			<GripVerticalIcon aria-hidden="true" />
		</Button>
	);
}

/** Whether dragging this node could change the tree at all: the lone root child cannot go anywhere. */
export function canFilterNodeMove(query: FilterQuery, position: Pick<FilterRowPosition, "parentId">): boolean {
	return position.parentId !== query.id || query.rules.length > 1;
}

/* -------------------------------------------------------------------------- */
/*                                  Rule row                                  */
/* -------------------------------------------------------------------------- */

export interface FilterAdvancedRowProps {
	readonly rule: FilterRule;
	readonly position: FilterRowPosition;
	readonly className?: string | undefined;
}

/** One condition: combinator, attribute, condition, value, grip and menu. */
export const FilterAdvancedRow = React.memo(
	React.forwardRef<HTMLDivElement, FilterAdvancedRowProps>(function FilterAdvancedRow({ rule, position, className }, ref): React.JSX.Element | null {
		const actions = useFilterActions();
		const sizes = filterControlSizes(actions);
		const focusStore = useFilterFocusStore();
		const locked = isFilterLocked(actions);
		const { query } = useFilterState();
		const reorderable = useFilterReorderable();
		const rowStateStore = useFilterRowStateStore();
		const pending = useFilterRowPending(rule.id);
		const issue = React.useContext(FilterIssueContext).get(rule.id);

		const field = getFilterField(actions.index, rule.path);
		const operators = field === undefined ? [] : actions.resolveOperators(field);
		const operator = getFilterOperator(operators, rule.operator);
		const takesValue = rule.operator !== "" && operatorTakesValue(operator);
		const display = useFilterRuleDisplay(rule, field, operator);
		const issueText = issue === undefined ? "" : filterIssueLabel(issue, actions.labels);

		const [pickerOpen, setPickerOpen] = useFilterAutoOpenSegment(rule.id, "field", locked);
		const [pickerPath, setPickerPath] = React.useState<readonly string[]>(rule.path.slice(0, -1));
		const [pickerQuery, setPickerQuery] = React.useState("");
		const [menuOpen, setMenuOpen] = React.useState(false);
		const ruleId = rule.id;
		const rulePath = rule.path;
		const { updateRule } = actions;

		const handlePickerOpenChange = React.useCallback(
			(next: boolean): void => {
				if (next && locked) {
					return;
				}
				if (next) {
					setPickerPath(rulePath.slice(0, -1));
					setPickerQuery("");
				}
				setPickerOpen(next);
			},
			[locked, rulePath, setPickerOpen],
		);

		const handleFieldSelect = React.useCallback(
			(path: readonly string[], defaultOperator: string | null): void => {
				setPickerOpen(false);
				rowStateStore.resolvePending(ruleId);
				if (!pending && isSameFilterPath(path, rulePath)) {
					return;
				}
				// A new field invalidates the condition and the value.
				updateRule(ruleId, { path, operator: pending ? "" : (defaultOperator ?? ""), value: undefined });
				if (pending) {
					focusStore.set({ id: ruleId, segment: "operator", autoOpen: true });
				}
			},
			[setPickerOpen, rowStateStore, ruleId, pending, rulePath, updateRule, focusStore],
		);

		const handleMenuOpenChange = React.useCallback(
			(next: boolean): void => {
				if (next && locked) {
					return;
				}
				setMenuOpen(next);
			},
			[locked],
		);

		if (field === undefined) {
			return null;
		}
		const canMove = reorderable && canFilterNodeMove(query, position);
		const rowLabel = actions.labels.rowLabel(`${display.pathText} ${display.operatorLabel}`, position.depth);

		return (
			<div
				ref={ref}
				role="group"
				aria-label={rowLabel}
				data-slot="filter-row"
				data-node-id={rule.id}
				data-parent-id={position.parentId}
				data-index={position.index}
				data-depth={position.depth}
				data-pending={pending ? "" : undefined}
				className={cn(filterAdvancedRowVariants({ kind: "rule", state: issue === undefined ? "default" : "invalid" }), className)}>
				<div className={COMBINATOR_BOX_CLASS}>
					<CombinatorCell index={position.index} parentId={position.parentId} combinator={position.combinator} />
				</div>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
					<div className="flex min-w-0 grow-0 basis-44">
						<Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
							<PopoverTrigger
								disabled={actions.disabled}
								{...filterReadOnlyProps(actions)}
								render={
									<Button
										type="button"
										variant="outline"
										size={sizes.button}
										aria-label={display.pathText}
										title={display.pathCollapsed ? undefined : display.pathText}
										{...cellProps("field")}
										className={CELL_CLASS}
									/>
								}>
								<span className="flex min-w-0 items-center gap-1.5 truncate">
									{field.icon}
									<span className="truncate">{display.pathLabel}</span>
								</span>
								<ChevronDownIcon aria-hidden="true" />
							</PopoverTrigger>
							<PopoverContent align="start" className={cn(FILTER_FIELD_PICKER_CLASS, actions.fieldPickerClassName)}>
								<FilterFieldPicker path={pickerPath} onPathChange={setPickerPath} query={pickerQuery} onQueryChange={setPickerQuery} onSelect={handleFieldSelect} />
							</PopoverContent>
						</Popover>
					</div>
					{pending ? null : (
						<div className="flex min-w-0 grow-0 basis-36">
							<FilterOperatorPopover
								rule={rule}
								field={field}
								trigger={
									<Button
										type="button"
										variant="outline"
										size={sizes.button}
										title={display.operatorLabel}
										{...cellProps("operator")}
										{...issueProps(issue, "operator", issueText)}
										className={cn(CELL_CLASS, "text-muted-foreground")}>
										<span className="truncate">{display.operatorLabel}</span>
										<ChevronDownIcon aria-hidden="true" />
									</Button>
								}
							/>
						</div>
					)}
					{!pending && takesValue ? (
						<div className="flex min-w-0 grow-0 basis-48">
							<FilterValuePopover
								rule={rule}
								field={field}
								operator={operator}
								trigger={
									<Button
										type="button"
										variant="outline"
										size={sizes.button}
										aria-label={`${field.label}: ${display.valueEmpty ? actions.labels.noValue : display.valueFullText}`}
										title={display.valueFullText}
										{...cellProps("value")}
										{...issueProps(issue, "value", issueText)}
										className={cn(CELL_CLASS, display.valueEmpty ? "text-muted-foreground" : undefined)}>
										<span className="truncate">{display.valueLabel}</span>
										<ChevronDownIcon aria-hidden="true" />
									</Button>
								}
							/>
						</div>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-0.5 pe-1 text-muted-foreground">
					{canMove ? <DragHandle nodeId={rule.id} label={display.pathText} /> : null}
					<DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
						<DropdownMenuTrigger
							disabled={actions.disabled}
							{...filterReadOnlyProps(actions)}
							render={<Button type="button" variant="ghost" size={sizes.icon} aria-label={actions.labels.chipMenu(field.label)} {...cellProps("menu")} />}>
							<EllipsisVerticalIcon aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className={cn(FILTER_MENU_CLASS, actions.menuClassName)}>
							<FilterRuleMenuItems ruleId={rule.id} allowGrouping />
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		);
	}),
);

/* -------------------------------------------------------------------------- */
/*                                   Group                                    */
/* -------------------------------------------------------------------------- */

interface FilterAdvancedGroupProps {
	readonly group: FilterGroupNode;
	readonly position: FilterRowPosition;
}

/** The first field a new condition starts on: the first pickable leaf, in schema order. */
function firstPickablePath(actions: FilterActionsContextValue): readonly string[] | null {
	return actions.index.all.find((entry: FilterIndexEntry): boolean => isFilterFieldPickable(entry.field))?.path ?? null;
}

/** Appends a pending condition to `parentId` and opens its attribute picker. Returns false when refused. */
function useAddCondition(): (parentId?: string) => void {
	const actions = useFilterActions();
	const rowStateStore = useFilterRowStateStore();
	const focusStore = useFilterFocusStore();
	return React.useCallback(
		(parentId?: string): void => {
			const path = firstPickablePath(actions);
			if (path === null || isFilterLocked(actions)) {
				return;
			}
			const id = actions.nextId();
			rowStateStore.markPending(id);
			actions.addRule(createFilterRule({ id, path, operator: "" }), parentId);
			focusStore.set({ id, segment: "field", autoOpen: true });
		},
		[actions, rowStateStore, focusStore],
	);
}

const GroupMenuAction = React.memo(function GroupMenuAction({
	groupId,
	icon,
	label,
	disabled,
	destructive,
	onAction,
}: {
	readonly groupId: string;
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly disabled: boolean;
	readonly destructive: boolean;
	readonly onAction: (groupId: string) => void;
}): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onAction(groupId);
	}, [onAction, groupId]);
	return (
		<DropdownMenuItem variant={destructive ? "destructive" : "default"} disabled={disabled} onClick={handleClick}>
			{icon}
			<span className={FILTER_MENU_LABEL_CLASS}>{label}</span>
		</DropdownMenuItem>
	);
});

/** A nested group: a row whose body is a card of rows under one combinator. */
function FilterAdvancedGroup({ group, position }: FilterAdvancedGroupProps): React.JSX.Element {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const locked = isFilterLocked(actions);
	const { query } = useFilterState();
	const reorderable = useFilterReorderable();
	const issue = React.useContext(FilterIssueContext).get(group.id);
	const addCondition = useAddCondition();
	const [menuOpen, setMenuOpen] = React.useState(false);
	const groupId = group.id;
	const { toggleCombinator } = actions;
	const headline = group.combinator === "and" ? actions.labels.groupAll : actions.labels.groupAny;

	const handleToggle = React.useCallback((): void => {
		toggleCombinator(groupId);
	}, [toggleCombinator, groupId]);
	const handleAdd = React.useCallback((): void => {
		addCondition(groupId);
	}, [addCondition, groupId]);
	const handleMenuOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next && locked) {
				return;
			}
			setMenuOpen(next);
		},
		[locked],
	);
	const canMove = reorderable && canFilterNodeMove(query, position);

	return (
		<div
			role="group"
			aria-label={actions.labels.groupLabel(headline, position.depth)}
			data-slot="filter-row"
			data-node-id={group.id}
			data-parent-id={position.parentId}
			data-index={position.index}
			data-depth={position.depth}
			className={filterAdvancedRowVariants({ kind: "group", state: issue === undefined ? "default" : "invalid" })}>
			<div className={cn(COMBINATOR_BOX_CLASS, "pt-1")}>
				<CombinatorCell index={position.index} parentId={position.parentId} combinator={position.combinator} />
			</div>
			<div
				data-slot="filter-group"
				data-drop-parent={group.id}
				data-drop-index={group.rules.length}
				data-invalid={issue === undefined ? undefined : ""}
				aria-description={issue === undefined ? undefined : filterIssueLabel(issue, actions.labels)}
				className={GROUP_CARD_CLASS}>
				<div className="flex items-center justify-between gap-1.5 pe-1">
					<Button
						type="button"
						variant="ghost"
						size={sizes.button}
						aria-label={actions.labels.combinatorLabel(headline)}
						disabled={actions.disabled}
						{...filterReadOnlyProps(actions)}
						{...cellProps("field")}
						className="min-w-0 justify-start font-normal text-muted-foreground"
						onClick={handleToggle}>
						<span className="truncate">{headline}</span>
					</Button>
					<div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
						{canMove ? <DragHandle nodeId={group.id} label={headline} /> : null}
						<DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
							<DropdownMenuTrigger
								disabled={actions.disabled}
								{...filterReadOnlyProps(actions)}
								render={<Button type="button" variant="ghost" size={sizes.icon} aria-label={actions.labels.groupMenu} {...cellProps("menu")} />}>
								<EllipsisVerticalIcon aria-hidden="true" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className={cn(FILTER_MENU_CLASS, actions.menuClassName)}>
								<GroupMenuAction
									groupId={group.id}
									icon={<UngroupIcon aria-hidden="true" />}
									label={actions.labels.ungroup}
									disabled={locked}
									destructive={false}
									onAction={actions.unwrapGroup}
								/>
								<FilterMoveToMenuItems nodeId={group.id} />
								<DropdownMenuSeparator />
								<GroupMenuAction
									groupId={group.id}
									icon={<Trash2Icon aria-hidden="true" />}
									label={actions.labels.removeGroup}
									disabled={locked}
									destructive
									onAction={actions.removeNode}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				{group.rules.length === 0 ? (
					<p className="px-2 text-sm text-muted-foreground">{actions.labels.groupPlaceholder}</p>
				) : (
					<FilterNodeList group={group} depth={position.depth + 1} />
				)}
				<div>
					<Button
						type="button"
						variant="ghost"
						size={sizes.button}
						aria-label={actions.labels.addToGroup}
						disabled={actions.disabled}
						{...filterReadOnlyProps(actions)}
						{...cellProps("add")}
						className="text-muted-foreground"
						onClick={handleAdd}>
						<PlusIcon aria-hidden="true" />
						{actions.labels.addCondition}
					</Button>
				</div>
			</div>
		</div>
	);
}

function FilterNodeList({ group, depth }: { readonly group: FilterGroupNode; readonly depth: number }): React.JSX.Element {
	return (
		<div data-slot="filter-rows" className="flex min-w-0 flex-col gap-3">
			{group.rules.map((node: FilterNode, index: number): React.JSX.Element => {
				const position: FilterRowPosition = { index, parentId: group.id, combinator: group.combinator, depth };
				return isFilterRule(node) ? (
					<FilterAdvancedRow key={node.id} rule={node} position={position} />
				) : (
					<FilterAdvancedGroup key={node.id} group={node} position={position} />
				);
			})}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                                  Keyboard                                  */
/* -------------------------------------------------------------------------- */

/** The cells a row owns ITSELF: a group's row contains its children's rows. */
function ownCells(row: HTMLElement): HTMLElement[] {
	return Array.from(row.querySelectorAll<HTMLElement>(`[${CELL_ATTRIBUTE}]`)).filter((cell: HTMLElement): boolean => cell.closest<HTMLElement>(FILTER_ROW_SELECTOR) === row);
}

function focusCell(row: HTMLElement | undefined, column: string | undefined): boolean {
	if (row === undefined) {
		return false;
	}
	const cells = ownCells(row);
	const [first] = cells;
	const target = cells.find((cell: HTMLElement): boolean => cell.getAttribute(CELL_ATTRIBUTE) === column) ?? first;
	target?.focus();
	return target !== undefined;
}

/* -------------------------------------------------------------------------- */
/*                                   Panel                                    */
/* -------------------------------------------------------------------------- */

export interface FiltersAdvancedPanelProps {
	readonly mode?: FilterAdvancedMode | undefined;
	/** Replaces the empty state; `null` from the callback draws none. */
	readonly renderEmpty?: ((context: FilterEmptyStateContext) => React.ReactNode) | undefined;
	readonly reorderable?: boolean | undefined;
	readonly className?: string | undefined;
}

/**
 * The advanced condition builder: nested groups, one combinator per group,
 * drag (and Alt+Arrow) reordering, and validation that appears only once the
 * user has committed a value to a row.
 */
export const FiltersAdvancedPanel = React.forwardRef<HTMLDivElement, FiltersAdvancedPanelProps>(function FiltersAdvancedPanel(
	{ mode = "popover", renderEmpty, reorderable = false, className },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	const render = useFilterRender();
	const sizes = filterControlSizes(actions);
	const { query, ruleCount, announcement, announcementSeq } = useFilterState();
	const rowStateStore = useFilterRowStateStore();
	const touchedIds = useFilterTouchedIds();
	const panelRef = React.useRef<HTMLDivElement | null>(null);
	const setPanelRef = React.useMemo(() => mergeRefs(panelRef, ref), [ref]);
	const locked = isFilterLocked(actions);
	const addCondition = useAddCondition();
	const readOnlyId = React.useId();
	const { resolveOperators, index, labels } = actions;

	const allIssues = React.useMemo((): readonly FilterIssue[] => {
		const arityOf = (rule: FilterRule): FilterOperatorArity | null => {
			const field = getFilterField(index, rule.path);
			if (field === undefined) {
				return null;
			}
			return getFilterArity(getFilterOperator(resolveOperators(field), rule.operator));
		};
		const validateOf = (rule: FilterRule): string | null | undefined => {
			const field = getFilterField(index, rule.path);
			const operator = field === undefined ? undefined : getFilterOperator(resolveOperators(field), rule.operator);
			if (field?.validate === undefined || operator === undefined) {
				return null;
			}
			return field.validate({ value: rule.value, values: filterValueItems(rule.value), field, operator, arity: getFilterArity(operator), rule, labels });
		};
		return collectFilterIssues(query, arityOf, validateOf);
	}, [query, index, resolveOperators, labels]);

	// Shown only for rules the user has given a value, and for groups.
	const visibleIssues = React.useMemo((): ReadonlyMap<string, FilterIssue> => {
		const map = new Map<string, FilterIssue>();
		for (const issue of allIssues) {
			if (issue.column === "group" || touchedIds.has(issue.nodeId)) {
				map.set(issue.nodeId, issue);
			}
		}
		return map;
	}, [allIssues, touchedIds]);

	const { moveNodeTo, copyNodeTo, moveNode } = actions;
	const handleDrop = React.useCallback(
		(nodeId: string, details: FilterDropDetails): void => {
			if (details.copy) {
				copyNodeTo(nodeId, details.parentId, details.index);
				return;
			}
			moveNodeTo(nodeId, details.parentId, details.index);
		},
		[copyNodeTo, moveNodeTo],
	);
	const getRoot = React.useCallback((): HTMLDivElement | null => panelRef.current, []);
	const drag = useFilterRowDrag({ root: getRoot, onDrop: handleDrop, disabled: locked });

	const handleKeyDown = React.useCallback(
		(event: KeyboardEvent): void => {
			if (!(event.target instanceof HTMLElement)) {
				return;
			}
			const cell = event.target.closest<HTMLElement>(`[${CELL_ATTRIBUTE}]`);
			const row = cell?.closest<HTMLElement>(FILTER_ROW_SELECTOR) ?? null;
			if (cell === null || row === null || event.target !== cell) {
				return;
			}
			const column = cell.getAttribute(CELL_ATTRIBUTE) ?? undefined;
			const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
			const delta = event.key === "ArrowUp" ? -1 : 1;
			const nodeId = row.dataset.nodeId;
			if (event.altKey && vertical) {
				event.preventDefault();
				if (!reorderable || locked || nodeId === undefined) {
					return;
				}
				moveNode(nodeId, delta);
				requestAnimationFrame((): void => {
					focusCell(panelRef.current?.querySelector<HTMLElement>(`${FILTER_ROW_SELECTOR}[data-node-id="${CSS.escape(nodeId)}"]`) ?? undefined, column);
				});
				return;
			}
			if (vertical) {
				const rows = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FILTER_ROW_SELECTOR) ?? []);
				if (focusCell(rows[rows.indexOf(row) + delta], column)) {
					event.preventDefault();
				}
				return;
			}
			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				const rtl = getComputedStyle(row).direction === "rtl";
				const forward = (event.key === "ArrowRight") !== rtl;
				const cells = ownCells(row);
				const next = cells[cells.indexOf(cell) + (forward ? 1 : -1)];
				if (next !== undefined) {
					event.preventDefault();
					next.focus();
				}
			}
		},
		[reorderable, locked, moveNode],
	);

	// A listener, not a JSX handler: the panel is a group, not a widget; the
	// cells inside it are the interactive elements the keys move between.
	React.useEffect((): (() => void) | undefined => {
		const panel = panelRef.current;
		if (panel === null) {
			return undefined;
		}
		panel.addEventListener("keydown", handleKeyDown);
		return (): void => {
			panel.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown]);

	const handleAddCondition = React.useCallback((): void => {
		addCondition();
	}, [addCondition]);
	const { addGroup, clearQuery } = actions;
	const handleAddGroup = React.useCallback((): void => {
		addGroup();
	}, [addGroup]);
	const handleClearAll = React.useCallback((): void => {
		clearQuery();
		rowStateStore.reset();
	}, [clearQuery, rowStateStore]);
	const handleJumpToIssue = React.useCallback((): void => {
		panelRef.current?.querySelector<HTMLElement>("[data-invalid]")?.focus();
	}, []);

	const emptyContext = React.useMemo(
		(): FilterEmptyStateContext => ({ labels, readOnly: locked, mode, addFilter: handleAddCondition, addGroup: handleAddGroup }),
		[labels, locked, mode, handleAddCondition, handleAddGroup],
	);
	const renderEmptyState = renderEmpty ?? render.renderEmpty;
	const canAdd = firstPickablePath(actions) !== null;
	const state = actions.disabled ? "disabled" : actions.readOnly ? "readonly" : "default";

	return (
		<FilterReorderProvider value={reorderable}>
			<FilterDragContext.Provider value={reorderable ? drag : null}>
				<FilterIssueContext.Provider value={visibleIssues}>
					<div
						ref={setPanelRef}
						role="group"
						aria-label={labels.advancedFilter}
						aria-describedby={actions.readOnly ? readOnlyId : undefined}
						data-slot="filters-advanced"
						data-mode={mode}
						data-readonly={actions.readOnly ? "" : undefined}
						className={cn(filtersAdvancedPanelVariants({ mode, state }), className)}>
						{actions.readOnly ? (
							<p id={readOnlyId} className="sr-only">
								{labels.readOnly}
							</p>
						) : null}
						{query.rules.length === 0 ? (
							(renderEmptyState?.(emptyContext) ?? (
								<div data-slot="filters-advanced-empty" className="flex flex-col items-center gap-1 py-6 text-center">
									<p className="text-sm font-medium">{labels.builderEmpty}</p>
									{locked ? null : <p className="text-sm text-muted-foreground">{labels.builderEmptyHint}</p>}
								</div>
							))
						) : (
							<FilterNodeList group={query} depth={1} />
						)}
						<div
							data-slot="filters-advanced-footer"
							data-drop-parent={query.id}
							data-drop-index={query.rules.length}
							className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
							<Button type="button" variant="ghost" size={sizes.button} disabled={actions.disabled || !canAdd} {...filterReadOnlyProps(actions)} onClick={handleAddCondition}>
								<PlusIcon aria-hidden="true" />
								{labels.addCondition}
							</Button>
							<Button type="button" variant="ghost" size={sizes.button} disabled={actions.disabled} {...filterReadOnlyProps(actions)} onClick={handleAddGroup}>
								<PlusIcon aria-hidden="true" />
								{labels.addConditionGroup}
							</Button>
							{visibleIssues.size > 0 ? (
								<Button type="button" variant="ghost" size={sizes.button} className="text-destructive" onClick={handleJumpToIssue}>
									{labels.issueSummary(visibleIssues.size)}
								</Button>
							) : null}
							{ruleCount > 0 || query.rules.length > 0 ? (
								<Button
									type="button"
									variant="ghost"
									size={sizes.button}
									className="ms-auto"
									disabled={actions.disabled}
									{...filterReadOnlyProps(actions)}
									onClick={handleClearAll}>
									{labels.clearAll}
								</Button>
							) : null}
						</div>
						<div aria-live="polite" role="status" className="sr-only">
							<span key={announcementSeq}>{announcement}</span>
						</div>
					</div>
				</FilterIssueContext.Provider>
			</FilterDragContext.Provider>
		</FilterReorderProvider>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Shell                                    */
/* -------------------------------------------------------------------------- */

export interface FiltersAdvancedProps {
	readonly mode?: FilterAdvancedMode | undefined;
	/** Replaces the default "Advanced filter" button (popover mode). */
	readonly trigger?: React.ReactElement | undefined;
	readonly reorderable?: boolean | undefined;
	readonly align?: "start" | "center" | "end" | undefined;
	readonly className?: string | undefined;
}

/** The advanced builder in a popover behind its trigger, or in place (`mode="inline"`). */
export const FiltersAdvanced = React.forwardRef<HTMLDivElement, FiltersAdvancedProps>(function FiltersAdvanced(
	{ mode = "popover", trigger, reorderable = false, align = "start", className },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const { ruleCount } = useFilterState();
	const defaultTrigger = React.useMemo(
		(): React.ReactElement => (
			<Button
				type="button"
				variant="outline"
				size={sizes.button}
				aria-label={ruleCount > 0 ? `${actions.labels.advancedFilter}, ${actions.labels.countAnnouncement(ruleCount)}` : undefined}>
				<ListFilterIcon aria-hidden="true" />
				{actions.labels.advancedFilter}
				{ruleCount > 0 ? (
					<span aria-hidden="true" className="rounded-sm bg-muted px-1.5 text-xs tabular-nums">
						{ruleCount}
					</span>
				) : null}
			</Button>
		),
		[sizes.button, actions.labels, ruleCount],
	);
	if (mode === "inline") {
		return <FiltersAdvancedPanel ref={ref} mode="inline" reorderable={reorderable} className={className} />;
	}
	return (
		<Popover>
			<PopoverTrigger disabled={actions.disabled} render={trigger ?? defaultTrigger} />
			<PopoverContent align={align} className="w-[min(48rem,calc(100vw-2rem))] p-0">
				<FiltersAdvancedPanel ref={ref} mode="popover" reorderable={reorderable} className={className} />
			</PopoverContent>
		</Popover>
	);
});
