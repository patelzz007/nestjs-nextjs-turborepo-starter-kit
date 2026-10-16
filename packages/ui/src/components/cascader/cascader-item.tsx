"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useCascaderActions, useCascaderRender, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import type { CascaderItemState } from "@workspace/ui/components/cascader/cascader-context";
import { getCascaderCount, getCascaderMoreParent, getCascaderPath, isCascaderMoreNode } from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderLoadState, CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";
import { Spinner } from "@workspace/ui/components/spinner";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { CheckIcon, ChevronRightIcon, LoaderCircleIcon, MinusIcon, RotateCwIcon } from "lucide-react";
import * as React from "react";

/** Base UI extends its synthetic events with a handler-veto escape hatch; a plain `<button>` row gets a plain event. */
export interface CascaderVetoableEvent {
	readonly preventBaseUIHandler?: (() => void) | undefined;
}

/** A row press. The veto hook is optional: an `as="button"` row is outside Base UI's listbox. */
export type CascaderRowEvent = React.MouseEvent<HTMLElement> & CascaderVetoableEvent;

/** Visual state of a row, paging row included. */
export type CascaderItemVisualState = "default" | "disabled" | "loading" | "error";

/** The row's inline inset, as a variable: a row and its absolutely positioned check land on the same number, in LOGICAL properties. */
const ROW_INSET_CLASS = "[--cascader-row-inset:calc(var(--spacing)*2)]";

/** Both insets equal, for a row with no check. */
const ROW_FLUSH_CLASS = "ps-(--cascader-row-inset) pe-(--cascader-row-inset)";

/** The same start inset plus room for the check. */
const ROW_GUTTER_CLASS = "ps-(--cascader-row-inset) pe-[calc(var(--cascader-row-inset)*2+var(--spacing)*4)]";

/** Tree rows add their depth's indent to the inset, never replace it. */
const ROW_TREE_INDENT_CLASS = "ps-[calc(var(--cascader-row-inset)+var(--cascader-indent,0px))]";

/** The check's box, inset to match the row's, logical so it mirrors under RTL. */
const INDICATOR_CLASS = "pointer-events-none absolute end-(--cascader-row-inset) flex size-4 items-center justify-center";

/** The row shell every row shares: highlight, disabled and icon sizing. No horizontal padding: every row pairs it with the flush or gutter inset. */
const ROW_SHELL_CLASS = `relative flex w-full cursor-default items-center rounded-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${ROW_INSET_CLASS}`;

/**
 * The row's variants. `size` sets the vertical rhythm and type, `state` the
 * paging row's and a disabled row's look — resolved, like every kit control,
 * with disabled first, then loading, then error.
 */
export const cascaderItemVariants = cva(ROW_SHELL_CLASS, {
	variants: {
		variant: {
			default: "gap-2",
			more: "justify-center gap-1.5 text-xs text-muted-foreground",
		},
		size: {
			sm: "min-h-7 py-1 text-xs",
			default: "min-h-8 py-1.5 text-sm",
			lg: "min-h-9 py-2 text-sm",
		},
		state: {
			default: "",
			disabled: "pointer-events-none opacity-50",
			loading: "cursor-wait",
			error: "text-destructive",
		},
	},
	compoundVariants: [{ variant: "more", state: "default", className: "hover:text-foreground" }],
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

/**
 * A footer COMMAND: the row theme, so it cannot drift from the list, plus the
 * hover and `focus-visible` fills a plain button never gets. Disabled keys off
 * `aria-disabled`, not `:disabled`, to keep it FOCUSABLE: a footer whose only
 * row is disabled would otherwise have no tab stop.
 */
export const CASCADER_ACTION_CLASS = `${ROW_SHELL_CLASS} ${ROW_FLUSH_CLASS} min-h-8 py-1.5 text-sm cursor-pointer gap-2 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50`;

/** The box around the affordances that are not the row. */
const AFFORDANCE_BOX_CLASS = "flex size-5 shrink-0 items-center justify-center rounded-sm";

/** What makes an affordance read as pressable on an already highlighted row. */
const AFFORDANCE_HOVER_CLASS = "transition-[background-color,box-shadow,color] hover:bg-background hover:text-foreground hover:shadow-xs";

/** The selection MARK's colour, pinned so the row's highlight rule cannot repaint it: a mark is STATE. */
const CHECKBOX_MARK_CLASS = "text-primary-foreground! **:text-primary-foreground!";
const INDICATOR_MARK_CLASS = "text-foreground! **:text-foreground!";

const CHECKBOX_CLASS =
	"flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors in-data-[indeterminate]:border-primary in-data-[indeterminate]:bg-primary in-data-[indeterminate]:text-primary-foreground in-data-[selected]:border-primary in-data-[selected]:bg-primary in-data-[selected]:text-primary-foreground";

/** Milliseconds the pointer must rest on a branch row before `expandTrigger="hover"` drills in. */
export const CASCADER_HOVER_EXPAND_DELAY_MS = 150;

/** Pixels each tree depth indents by, by default. */
export const CASCADER_TREE_INDENT_PX = 16;

/** CSS custom properties are kebab-case by spec, so the key is declared via `Record`. */
type CascaderIndentStyle = React.CSSProperties & Readonly<Record<"--cascader-indent", string>>;

const DASH_ICON = <MinusIcon data-slot="cascader-item-dash" aria-hidden className={cn(CHECKBOX_MARK_CLASS, "size-3")} />;
const TICK_ICON = <CheckIcon data-slot="cascader-item-tick" aria-hidden className={cn(CHECKBOX_MARK_CLASS, "size-3 opacity-0 in-data-[selected]:opacity-100")} />;
const CHECK_ICON = <CheckIcon data-slot="cascader-item-check" aria-hidden className={cn("pointer-events-none", INDICATOR_MARK_CLASS)} />;
const RETRY_ICON = <RotateCwIcon aria-hidden className="size-4" />;
const ROW_SPINNER = <Spinner aria-hidden className="size-4" />;
const INDICATOR_RENDER = <span data-slot="cascader-item-indicator" className={INDICATOR_CLASS} />;

/** The ARIA a caller may set on a row: set metadata, a name, and a trail row's link to the column it opened. */
export type CascaderItemAriaProps = Pick<React.AriaAttributes, "aria-label" | "aria-setsize" | "aria-posinset" | "aria-expanded" | "aria-controls">;

export interface CascaderItemProps extends CascaderItemAriaProps {
	readonly node: CascaderNodeBase;
	/** Explicit render index. Required while virtualized and DELIBERATELY IGNORED otherwise: it self-registers the row and breaks `aria-activedescendant`. */
	readonly index?: number | undefined;
	/** Indentation depth. Drives `--cascader-indent` in tree mode. */
	readonly depth?: number | undefined;
	/** Renders the ancestor chain under the label, for deep and global search. */
	readonly showPath?: boolean | undefined;
	/** `option` renders a real `Combobox.Item`; `button` renders identical markup outside the listbox, for the ancestor columns in columns mode. */
	readonly as?: "option" | "button" | undefined;
	/** Tree mode: this row is an expanded branch. */
	readonly expanded?: boolean | undefined;
	/** Indent each depth by this many pixels. Tree mode only. */
	readonly indent?: number | undefined;
	/** Whether the node has children. Defaults to the cascader's own answer, as do the four below: callers pass them so a memoised row stays off the volatile context. */
	readonly branch?: boolean | undefined;
	readonly selectable?: boolean | undefined;
	readonly selected?: boolean | undefined;
	/** Some but not all of the loaded subtree selected. `cascade` only. */
	readonly indeterminate?: boolean | undefined;
	/** Selected nodes below this one, at any depth. Drives the trailing count. */
	readonly selectedCount?: number | undefined;
	/** Paging row only: a request for this level is in flight. */
	readonly loading?: boolean | undefined;
	/** Paging row only: this level's last request failed. */
	readonly error?: boolean | undefined;
	/** Branch row only: this node's OWN children are being fetched. The chevron becomes a spinner IN PLACE. */
	readonly childrenLoading?: boolean | undefined;
	/** Branch row only: the last fetch of this node's children failed. The same box becomes the retry. */
	readonly childrenError?: boolean | undefined;
	readonly className?: string | undefined;
	readonly style?: React.CSSProperties | undefined;
	readonly onClick?: ((event: CascaderRowEvent) => void) | undefined;
	readonly onMouseUp?: ((event: CascaderRowEvent) => void) | undefined;
	readonly title?: string | undefined;
	/** The position the virtualizer measures this row at, written to `data-index`. Windowed rows only. */
	readonly measureIndex?: number | undefined;
	/** Trail rows only: this row's column is open to its right. */
	readonly open?: boolean | undefined;
	readonly children?: React.ReactNode;
}

function vetoBaseUiHandler(event: CascaderVetoableEvent): void {
	event.preventBaseUIHandler?.();
}

function resolveItemState(disabled: boolean, loading: boolean, error: boolean): CascaderItemVisualState {
	if (disabled) {
		return "disabled";
	}
	if (loading) {
		return "loading";
	}
	return error ? "error" : "default";
}

function resolveAffordanceState(childrenLoading: boolean, childrenError: boolean): "error" | "loading" | "idle" {
	if (childrenError) {
		return "error";
	}
	return childrenLoading ? "loading" : "idle";
}

/** The slots of the in-row affordances, which act on their own instead of the row's press. */
const AFFORDANCE_SELECTOR = '[data-slot="cascader-item-expander"],[data-slot="cascader-item-chevron"]';

/** Which in-row affordance a press landed on. The row owns the press (an affordance is no interactive element of its own: nesting one in `role="option"` fails axe). */
function pressedAffordance(event: CascaderRowEvent): "expander" | "chevron" | null {
	const { target } = event;
	if (!(target instanceof Element)) {
		return null;
	}
	const slot = target.closest(AFFORDANCE_SELECTOR)?.getAttribute("data-slot");
	if (slot === "cascader-item-expander") {
		return "expander";
	}
	return slot === "cascader-item-chevron" ? "chevron" : null;
}

/** Keeps focus in the search field: Base UI prevents the mousedown default for option rows, and focusing a `tabindex="-1"` trail row kills every key. */
function keepFocusInField(event: React.MouseEvent<HTMLElement>): void {
	event.preventDefault();
}

/** One row. Branch presses navigate instead of selecting, vetoed with `preventBaseUIHandler()` on `onClick` (Enter too) and on `onMouseUp`. */
const CascaderItemInner = React.forwardRef<HTMLElement, CascaderItemProps>(function CascaderItem(
	{
		node,
		index,
		depth,
		showPath = false,
		as = "option",
		expanded = false,
		indent = CASCADER_TREE_INDENT_PX,
		branch: branchProp,
		selectable: selectableProp,
		selected: selectedProp,
		indeterminate: indeterminateProp,
		selectedCount: selectedCountProp,
		loading = false,
		error = false,
		childrenLoading = false,
		childrenError = false,
		className,
		children,
		onClick,
		onMouseUp,
		style,
		title,
		"aria-label": ariaLabel,
		"aria-setsize": ariaSetSize,
		"aria-posinset": ariaPosInSet,
		"aria-expanded": ariaExpanded,
		"aria-controls": ariaControls,
		measureIndex,
		open: trailOpen = false,
	},
	ref,
): React.JSX.Element {
	// The ACTIONS context only: the state context republishes on every keystroke.
	const {
		index: treeIndex,
		mode,
		size,
		labels,
		isBranch,
		isSelectable,
		isDisabled,
		isSelected,
		isIndeterminate,
		selectedDescendantCount,
		multiple,
		branchesSelectable,
		indicator: indicatorEnabled,
		expandTrigger,
		navigate,
		navigateAt,
		toggleExpanded,
		commit,
		getState,
		virtualized,
		loadMore,
		retryLevel,
	} = useCascaderActions();
	// Render props come from an always-current context, or a closure goes stale.
	const { renderItem, renderLabel } = useCascaderRender();

	const isMore = isCascaderMoreNode(node);
	const branch = branchProp ?? isBranch(node);
	const selectable = selectableProp ?? isSelectable(node);
	// An ancestor's flag counts: a search hit or a revealed path can list a row inside a branch nobody may open.
	const disabled = isDisabled(node);
	const selected = selectedProp ?? isSelected(node);
	// A selected node is never also partially selected (a dash in a filled box).
	const indeterminate = !selected && (indeterminateProp ?? isIndeterminate(node));
	const count = branch ? getCascaderCount(treeIndex, node) : 0;
	const nodeDepth = depth ?? treeIndex.depthOf.get(node.value) ?? 0;
	const tree = mode === "tree";

	const selectedDescendants = branch ? (selectedCountProp ?? selectedDescendantCount(node)) : 0;
	// `multiple` only: with a single selection the trigger and the leaf's own check already say where it is.
	const showsSelectedCount = multiple && selectedDescendants > 0;
	const trailingCount = showsSelectedCount ? selectedDescendants : count;
	const showCount = trailingCount > 0;
	// A multi-select tree puts its checkbox at the HEAD of the row, since a trailing box does not follow the label stagger.
	const leadingCheckbox = tree && multiple;
	// `|| multiple`: a checkbox is the selection CONTROL, so `indicator={false}` is a no-op in multi-select.
	const showsIndicator = indicatorEnabled || multiple;

	const setRef = React.useCallback(
		(element: HTMLElement | null): void => {
			assignRef(ref, element);
		},
		[ref],
	);

	// The tree expander's own press: with `selectable="any"` the row press commits, so expanding needs its own target.
	// A disabled row may still CLOSE what `expanded` opened, never open.
	const pressExpander = React.useCallback(
		(event: CascaderRowEvent): void => {
			vetoBaseUiHandler(event);
			if (expanded) {
				if (!disabled || getState().expanded.has(node.value)) {
					toggleExpanded(node.value);
				}
			} else if (!disabled) {
				navigate(node);
			}
		},
		[node, disabled, expanded, getState, toggleExpanded, navigate],
	);

	const pressChevron = React.useCallback(
		(event: CascaderRowEvent): void => {
			vetoBaseUiHandler(event);
			if (disabled) {
				return;
			}
			// From an ancestor column `navigate` would append and duplicate the level; `navigateAt` rebuilds the trail from this depth.
			if (as === "button") {
				navigateAt(node, depth ?? 0);
			} else {
				navigate(node);
			}
		},
		[node, disabled, as, navigateAt, depth, navigate],
	);

	/** Whether a press on an affordance is the affordance's own: the expander always, the chevron only on a committable branch (elsewhere it is part of the row). */
	const affordanceOwnsPress = React.useCallback(
		(event: CascaderRowEvent): "expander" | "chevron" | null => {
			const affordance = pressedAffordance(event);
			if (affordance === "chevron" && !selectable) {
				return null;
			}
			return affordance;
		},
		[selectable],
	);

	const handleClick = React.useCallback(
		(event: CascaderRowEvent): void => {
			const affordance = affordanceOwnsPress(event);
			if (affordance === "expander") {
				pressExpander(event);
				return;
			}
			if (affordance === "chevron") {
				pressChevron(event);
				return;
			}
			onClick?.(event);
			if (disabled) {
				return;
			}
			if (branch && !selectable) {
				vetoBaseUiHandler(event);
				navigate(node);
			}
		},
		[affordanceOwnsPress, pressExpander, pressChevron, onClick, node, disabled, branch, selectable, navigate],
	);

	const handleMouseUp = React.useCallback(
		(event: CascaderRowEvent): void => {
			// Base UI treats a drag-select mouseup as a commit; a press on an affordance is not one.
			if (affordanceOwnsPress(event) !== null) {
				vetoBaseUiHandler(event);
				return;
			}
			onMouseUp?.(event);
			if (!disabled && branch && !selectable) {
				vetoBaseUiHandler(event);
			}
		},
		[affordanceOwnsPress, onMouseUp, disabled, branch, selectable],
	);

	const handleButtonClick = React.useCallback(
		(event: CascaderRowEvent): void => {
			if (affordanceOwnsPress(event) === "chevron") {
				pressChevron(event);
				return;
			}
			onClick?.(event);
			if (disabled) {
				return;
			}
			if (branch && !selectable) {
				// Button rows only exist in the columns trail, where `depth` is the column's own depth.
				navigateAt(node, depth ?? 0);
				return;
			}
			if (selectable) {
				commit(node);
			}
		},
		[affordanceOwnsPress, pressChevron, onClick, node, disabled, branch, selectable, navigateAt, depth, commit],
	);

	// The paging row's press, never a selection, whatever `selectable` says.
	const handleMoreClick = React.useCallback(
		(event: CascaderRowEvent): void => {
			onClick?.(event);
			vetoBaseUiHandler(event);
			const parent = getCascaderMoreParent(node);
			if (parent === null) {
				return;
			}
			if (error) {
				retryLevel(parent);
			} else if (!loading) {
				loadMore(parent);
			}
		},
		[onClick, node, error, loading, retryLevel, loadMore],
	);

	// `expandTrigger="hover"`: resting on a BRANCH row in the ACTIVE column drills in after a delay. It never commits.
	const hoverNavigates = expandTrigger === "hover" && mode === "columns" && as === "option" && branch && !disabled;
	const hoverTimerRef = React.useRef<number | null>(null);

	const cancelHoverNavigate = React.useCallback((): void => {
		if (hoverTimerRef.current === null) {
			return;
		}
		window.clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = null;
	}, []);

	const handleHoverPointerEnter = React.useCallback((): void => {
		cancelHoverNavigate();
		hoverTimerRef.current = window.setTimeout((): void => {
			hoverTimerRef.current = null;
			navigate(node);
		}, CASCADER_HOVER_EXPAND_DELAY_MS);
	}, [cancelHoverNavigate, navigate, node]);

	// Drilling in demotes this column to the trail WITHOUT unmounting the row, so a pending timer has to die.
	React.useEffect((): void => {
		if (!hoverNavigates) {
			cancelHoverNavigate();
		}
	}, [hoverNavigates, cancelHoverNavigate]);
	React.useEffect((): (() => void) => cancelHoverNavigate, [cancelHoverNavigate]);

	const rowStyle = React.useMemo((): React.CSSProperties | undefined => {
		if (!tree || nodeDepth === 0) {
			return style;
		}
		const indentStyle: CascaderIndentStyle = { ...style, "--cascader-indent": `${String(nodeDepth * indent)}px` };
		return indentStyle;
	}, [tree, nodeDepth, indent, style]);

	const itemState = React.useMemo(
		(): CascaderItemState => ({
			branch,
			selected,
			disabled,
			depth: nodeDepth,
			count,
			path: showPath ? getCascaderPath(treeIndex, node.value).slice(0, -1) : [],
		}),
		[branch, selected, disabled, nodeDepth, count, showPath, treeIndex, node.value],
	);

	/* ------------------------------- paging row ------------------------------ */

	if (isMore) {
		const moreText = resolveMoreText(error, loading, (node.count ?? 0) > 0, labels.error, labels.loadingMore, labels.loading, labels.loadMore);
		const moreClassName = cn(
			cascaderItemVariants({ variant: "more", size, state: resolveItemState(false, loading, error) }),
			ROW_FLUSH_CLASS,
			tree ? ROW_TREE_INDENT_CLASS : undefined,
			className,
		);
		const moreBody = children ?? (
			<>
				{loading ? <LoaderCircleIcon aria-hidden className="size-3.5 motion-safe:animate-spin" /> : null}
				<span>{moreText}</span>
				{/* TEXT, not a button: a focusable element inside a `role="option"` row is a `nested-interactive` violation. */}
				{error ? <span className="font-medium text-foreground">{labels.retry}</span> : null}
			</>
		);
		const moreState = resolveAffordanceState(loading, error);

		if (as === "button") {
			return (
				<button
					ref={setRef}
					type="button"
					data-slot="cascader-item"
					data-more=""
					data-state={moreState}
					data-depth={nodeDepth}
					data-index={measureIndex}
					style={rowStyle}
					className={moreClassName}
					tabIndex={-1}
					title={title}
					onClick={handleMoreClick}>
					{moreBody}
				</button>
			);
		}

		return (
			<ComboboxPrimitive.Item
				ref={setRef}
				data-slot="cascader-item"
				data-more=""
				data-state={moreState}
				data-depth={nodeDepth}
				data-index={measureIndex}
				style={rowStyle}
				className={moreClassName}
				value={node}
				index={virtualized ? index : undefined}
				role={tree ? "treeitem" : "option"}
				aria-level={tree ? nodeDepth + 1 : undefined}
				aria-setsize={ariaSetSize}
				aria-posinset={ariaPosInSet}
				title={title}
				onClick={handleMoreClick}
				onMouseUp={vetoBaseUiHandler}>
				{moreBody}
			</ComboboxPrimitive.Item>
		);
	}

	const custom = renderItem?.(node, itemState);
	const customLabel = renderLabel?.(node, itemState);

	// What the markup cannot say: a branch would announce a naked number. Trail rows are outside the listbox, so they need words for state.
	const srDetails = buildSrDetails([
		branch ? labels.itemCount(count) : null,
		showsSelectedCount ? labels.selectedCount(selectedDescendants) : null,
		branch && !tree ? labels.branchAffordance : null,
		as === "button" && selected ? labels.selectedState : null,
		as === "button" && indeterminate ? labels.partiallySelectedState : null,
	]);

	const affordanceState = resolveAffordanceState(childrenLoading, childrenError);
	const affordanceIcon = resolveAffordanceIcon(childrenLoading, childrenError);
	const checkbox = (
		<span data-slot="cascader-item-checkbox" className={CHECKBOX_CLASS}>
			{indeterminate ? DASH_ICON : TICK_ICON}
		</span>
	);
	const indicatorMark = multiple ? checkbox : CHECK_ICON;
	const countClassName = cn(showsSelectedCount ? "text-primary!" : undefined);

	const body = custom ?? children ?? (
		<>
			{/* Tree mode expands in place, so the branch marker leads the row. */}
			{tree && branch ? (
				<span
					data-slot="cascader-item-expander"
					aria-hidden="true"
					data-state={affordanceState}
					className={cn(
						"-ms-0.5",
						childrenError ? "text-destructive" : "text-muted-foreground",
						AFFORDANCE_BOX_CLASS,
						AFFORDANCE_HOVER_CLASS,
						// A disabled row is `pointer-events-none`; only while open does its expander take the pointer back, to close what `expanded` opened.
						disabled && expanded ? "pointer-events-auto" : undefined,
						childrenLoading ? "pointer-events-none" : undefined,
					)}>
					{affordanceIcon ?? <ChevronRightIcon aria-hidden className={cn("size-4 transition-transform", expanded ? "rotate-90" : "rtl:-scale-x-100")} />}
				</span>
			) : null}
			{/* A LEAF's expander slot, reserved and empty, so its label lines up with its sibling branches'. */}
			{tree && !branch ? <span data-slot="cascader-item-expander-spacer" aria-hidden="true" className={cn("-ms-0.5", AFFORDANCE_BOX_CLASS)} /> : null}

			{/* Tree + multi-select: the box leads the row, and an unselectable row still reserves its width. */}
			{leadingCheckbox && selectable ? checkbox : null}
			{leadingCheckbox && !selectable ? <span data-slot="cascader-item-checkbox-spacer" aria-hidden="true" className="size-4 shrink-0" /> : null}

			{node.icon === undefined ? null : (
				<span data-slot="cascader-item-icon" className="flex shrink-0 items-center justify-center text-muted-foreground">
					{node.icon}
				</span>
			)}

			<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
				{customLabel ?? (
					<>
						<span className="w-full truncate text-start">{node.label}</span>
						{node.description === undefined ? null : (
							<span data-slot="cascader-item-description" className="w-full truncate text-start text-xs text-muted-foreground">
								{node.description}
							</span>
						)}
					</>
				)}
				{showPath ? <CascaderItemPath node={node} /> : null}
			</span>

			{srDetails === "" ? null : (
				<span data-slot="cascader-item-details" className="sr-only">
					{srDetails}
				</span>
			)}

			{/* Tree mode expands in place, so it has no drill-in chevron. */}
			{branch && !tree ? (
				<span data-slot="cascader-item-trailing" aria-hidden="true" className="ms-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
					{showCount ? (
						<span data-slot="cascader-item-count" data-selected-count={showsSelectedCount ? "" : undefined} className={countClassName}>
							{trailingCount}
						</span>
					) : null}
					{/* ONLY the chevron is the drill target: sharing a hit area with the count made a number pressable. */}
					<span
						data-slot="cascader-item-chevron"
						data-state={affordanceState}
						className={cn(
							"-me-0.5",
							AFFORDANCE_BOX_CLASS,
							selectable ? AFFORDANCE_HOVER_CLASS : undefined,
							childrenError ? "text-destructive" : undefined,
							childrenLoading ? "pointer-events-none" : undefined,
						)}>
						{affordanceIcon ?? <ChevronRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />}
					</span>
				</span>
			) : null}

			{branch && tree && showCount ? (
				<span
					data-slot="cascader-item-count"
					data-selected-count={showsSelectedCount ? "" : undefined}
					aria-hidden="true"
					className={cn("ms-auto shrink-0 text-xs text-muted-foreground tabular-nums", countClassName)}>
					{trailingCount}
				</span>
			) : null}

			{/* No trailing indicator when a tree's box led the row, or when `indicator={false}` opted out. */}
			{selectable && !leadingCheckbox && showsIndicator && as === "button" && (multiple || selected) ? (
				<span data-slot="cascader-item-indicator" className={INDICATOR_CLASS}>
					{indicatorMark}
				</span>
			) : null}
			{selectable && !leadingCheckbox && showsIndicator && as === "option" ? (
				// Kept mounted for a partial selection too: the row is not selected, so Base UI would unmount the box the dash lives in.
				<ComboboxPrimitive.ItemIndicator keepMounted={multiple || indeterminate} render={INDICATOR_RENDER}>
					{indicatorMark}
				</ComboboxPrimitive.ItemIndicator>
			) : null}
		</>
	);

	// The check gutter is handed back when a tree's box leads the row, when `indicator={false}` drops the check, or for branches that can never be committed.
	const rowClassName = cn(
		cascaderItemVariants({ variant: "default", size, state: resolveItemState(disabled, false, false) }),
		leadingCheckbox || !showsIndicator || (branch && !branchesSelectable) ? ROW_FLUSH_CLASS : ROW_GUTTER_CLASS,
		tree ? ROW_TREE_INDENT_CLASS : undefined,
		trailOpen ? "bg-accent/60 text-accent-foreground" : undefined,
		className,
	);

	if (as === "button") {
		return (
			<button
				ref={setRef}
				type="button"
				data-slot="cascader-item"
				data-branch={branch ? "" : undefined}
				data-selected={selected ? "" : undefined}
				data-indeterminate={indeterminate ? "" : undefined}
				data-depth={nodeDepth}
				data-expanded={expanded ? "" : undefined}
				data-open={trailOpen ? "" : undefined}
				data-index={measureIndex}
				style={rowStyle}
				className={rowClassName}
				// Focus stays in the search input; the trail uses the level keys.
				tabIndex={-1}
				disabled={disabled}
				aria-disabled={disabled ? true : undefined}
				aria-label={ariaLabel}
				aria-expanded={ariaExpanded}
				aria-controls={ariaControls}
				title={title}
				onClick={handleButtonClick}
				onMouseDown={keepFocusInField}>
				{body}
			</button>
		);
	}

	return (
		<ComboboxPrimitive.Item
			ref={setRef}
			data-slot="cascader-item"
			data-branch={branch ? "" : undefined}
			data-selected={selected ? "" : undefined}
			data-indeterminate={indeterminate ? "" : undefined}
			data-depth={nodeDepth}
			data-expanded={expanded ? "" : undefined}
			data-index={measureIndex}
			style={rowStyle}
			className={rowClassName}
			value={node}
			// THE one gate for the explicit index: supplied outside virtualized mode, the first arrow key leaves `aria-activedescendant` pointing at nothing.
			index={virtualized ? index : undefined}
			disabled={disabled}
			role={tree ? "treeitem" : "option"}
			aria-level={tree ? nodeDepth + 1 : undefined}
			aria-expanded={tree && branch ? expanded : undefined}
			aria-haspopup={!tree && branch ? "listbox" : undefined}
			// Only ever `mixed`: a selected row already says so with `aria-selected`.
			aria-checked={indeterminate ? "mixed" : undefined}
			aria-setsize={ariaSetSize}
			aria-posinset={ariaPosInSet}
			aria-label={ariaLabel}
			title={title}
			onPointerEnter={hoverNavigates ? handleHoverPointerEnter : undefined}
			onPointerLeave={hoverNavigates ? cancelHoverNavigate : undefined}
			onClick={handleClick}
			onMouseUp={handleMouseUp}>
			{body}
		</ComboboxPrimitive.Item>
	);
});

/** The paging row's wording: the failure, the first page or the next one in flight, or the idle "load more". */
function resolveMoreText(error: boolean, loading: boolean, hasRows: boolean, errorText: string, loadingMoreText: string, loadingText: string, loadMoreText: string): string {
	if (error) {
		return errorText;
	}
	if (loading) {
		return hasRows ? loadingMoreText : loadingText;
	}
	return loadMoreText;
}

function resolveAffordanceIcon(childrenLoading: boolean, childrenError: boolean): React.JSX.Element | null {
	if (childrenLoading) {
		return ROW_SPINNER;
	}
	return childrenError ? RETRY_ICON : null;
}

function buildSrDetails(details: readonly (string | null)[]): string {
	return details
		.filter((detail: string | null): detail is string => detail !== null)
		.map((detail: string): string => `, ${detail}`)
		.join("");
}

/** One row of the active level, the deepest column or the tree. Memoised: its props are plain booleans the parent answers once. */
const CascaderItem = React.memo(CascaderItemInner);

interface CascaderItemPathProps {
	readonly node: CascaderNodeBase;
}

/** Ancestor chain under a deep or global hit: "Name" alone is ambiguous. */
function CascaderItemPath({ node }: CascaderItemPathProps): React.JSX.Element | null {
	const { index, labels } = useCascaderActions();
	const ancestors = getCascaderPath(index, node.value).slice(0, -1);
	if (ancestors.length === 0) {
		return null;
	}

	return (
		<span data-slot="cascader-item-path" className="flex w-full items-center gap-0.5 truncate text-start text-xs text-muted-foreground">
			{ancestors.map((ancestor: CascaderNodeBase, position: number): React.JSX.Element => (
				<React.Fragment key={ancestor.value}>
					{position > 0 ? <span aria-hidden="true">{labels.pathSeparator}</span> : null}
					<span className="truncate">{ancestor.label}</span>
				</React.Fragment>
			))}
		</span>
	);
}

/** The load-derived props a row needs, as `getCascaderMoreProps` answers them. */
export interface CascaderMoreProps {
	readonly loading: boolean;
	readonly error: boolean;
	readonly childrenLoading: boolean;
	readonly childrenError: boolean;
}

/**
 * Every load-derived prop a row needs. A PAGING row reports the level it
 * belongs to, a BRANCH row the level it OWNS; mutually exclusive, so one call
 * answers both. Exported because a memoised row cannot read them itself.
 */
export function getCascaderMoreProps(node: CascaderNodeBase, loadStates: ReadonlyMap<string, CascaderLoadState>): CascaderMoreProps {
	const parent = getCascaderMoreParent(node);
	if (parent === null) {
		const own = loadStates.get(node.value);
		return { loading: false, error: false, childrenLoading: own?.loading === true, childrenError: own?.error === true };
	}
	const state = loadStates.get(parent);
	return { loading: state?.loading === true, error: state?.error === true, childrenLoading: false, childrenError: false };
}

export interface CascaderItemsProps {
	/** Replaces the default row for every item. */
	readonly children?: ((node: CascaderNodeBase, index: number) => React.ReactNode) | undefined;
}

/**
 * Whatever the active view is: the current level, the deepest column, or the
 * flattened tree rows. Renders rows only — no element of its own, so nothing to
 * forward a ref to. `index` is deliberately not passed; see `CascaderItemProps`.
 */
function CascaderItems({ children }: CascaderItemsProps): React.JSX.Element {
	const { mode, isBranch, isSelectable, isSelected, isIndeterminate } = useCascaderActions();
	const { renderedItems, deepResults, treeRows, loadStates } = useCascaderState();
	const showPath = deepResults !== null;

	if (mode === "tree") {
		return (
			<>
				{treeRows.map((row, position: number): React.JSX.Element =>
					children === undefined ? (
						<CascaderItem
							key={row.node.value}
							node={row.node}
							depth={row.depth}
							expanded={row.expanded}
							branch={row.branch}
							selectable={isSelectable(row.node)}
							selected={isSelected(row.node)}
							indeterminate={isIndeterminate(row.node)}
							{...getCascaderMoreProps(row.node, loadStates)}
							aria-setsize={row.setSize}
							aria-posinset={row.posInSet}
						/>
					) : (
						<React.Fragment key={row.node.value}>{children(row.node, position)}</React.Fragment>
					),
				)}
			</>
		);
	}

	return (
		<>
			{renderedItems.map((node: CascaderNodeBase, position: number): React.JSX.Element =>
				children === undefined ? (
					<CascaderItem
						key={node.value}
						node={node}
						showPath={showPath}
						branch={isBranch(node)}
						selectable={isSelectable(node)}
						selected={isSelected(node)}
						indeterminate={isIndeterminate(node)}
						{...getCascaderMoreProps(node, loadStates)}
						aria-setsize={renderedItems.length}
						aria-posinset={position + 1}
					/>
				) : (
					<React.Fragment key={node.value}>{children(node, position)}</React.Fragment>
				),
			)}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*                          Group / Label / Separator                         */
/* -------------------------------------------------------------------------- */

// Whether a `CascaderLabel` has a group to name: Base UI's `Combobox.GroupLabel` THROWS when there is none, and a heading is useful outside a group.
const CascaderGroupContext = React.createContext(false);

const CASCADER_LABEL_CLASS = `${ROW_INSET_CLASS} ${ROW_FLUSH_CLASS} block truncate py-1.5 text-xs text-muted-foreground`;

/** A rule between two runs, reaching the list's edge through `--cascader-list-pad`. */
const CASCADER_SEPARATOR_CLASS = "-mx-(--cascader-list-pad) my-1 h-px shrink-0 bg-border";

export interface CascaderGroupProps extends Omit<ComboboxPrimitive.Group.Props, "className"> {
	readonly className?: string | undefined;
}

/**
 * A run of related rows, named by the `CascaderLabel` inside it: the group is
 * `role="group"` and Base UI points its `aria-labelledby` at the label.
 * Grouping is composition, not data: `CascaderItems` renders one flat run per
 * level, so its indices line up with Base UI's list.
 */
const CascaderGroup = React.forwardRef<HTMLDivElement, CascaderGroupProps>(function CascaderGroup({ className, ...props }, ref): React.JSX.Element {
	return (
		<CascaderGroupContext.Provider value>
			<ComboboxPrimitive.Group ref={ref} data-slot="cascader-group" className={cn("flex flex-col", className)} {...props} />
		</CascaderGroupContext.Provider>
	);
});

export interface CascaderLabelProps extends Omit<ComboboxPrimitive.GroupLabel.Props, "className" | "style"> {
	readonly className?: string | undefined;
	readonly style?: React.CSSProperties | undefined;
}

/** Inside a group: the real thing, with the id association Base UI wires up. */
const CascaderGroupLabel = React.forwardRef<HTMLDivElement, CascaderLabelProps>(function CascaderGroupLabel({ className, ...props }, ref): React.JSX.Element {
	return <ComboboxPrimitive.GroupLabel ref={ref} data-slot="cascader-label" className={cn(CASCADER_LABEL_CLASS, className)} {...props} />;
});

// Outside a group: the same heading as a plain element. A separate component rather than a branch, so the hook count cannot change when a label moves in.
const CascaderPlainLabel = React.forwardRef<HTMLDivElement, CascaderLabelProps>(function CascaderPlainLabel({ className, render, ...props }, ref): React.ReactElement {
	const defaultProps = { "data-slot": "cascader-label", className: cn(CASCADER_LABEL_CLASS, className) };
	return useRender({ defaultTagName: "div", render, ref, props: mergeProps<"div">(defaultProps, props) });
});

/** A heading. Inside `CascaderGroup` it is the group's accessible name; outside one (the footer flyout is a menu, not a listbox) it is decoration only. */
const CascaderLabel = React.forwardRef<HTMLDivElement, CascaderLabelProps>(function CascaderLabel(props, ref): React.JSX.Element {
	const grouped = React.useContext(CascaderGroupContext);
	return grouped ? <CascaderGroupLabel ref={ref} {...props} /> : <CascaderPlainLabel ref={ref} {...props} />;
});

export interface CascaderSeparatorProps extends Omit<ComboboxPrimitive.Separator.Props, "className"> {
	readonly className?: string | undefined;
}

/**
 * Decorative on purpose: Base UI's separator is `role="separator"`, which a
 * `listbox` may not own; a run that needs separating for a screen reader
 * needs a `CascaderGroup`, not a line.
 */
const CascaderSeparator = React.forwardRef<HTMLDivElement, CascaderSeparatorProps>(function CascaderSeparator({ className, ...props }, ref): React.JSX.Element {
	return (
		<ComboboxPrimitive.Separator
			ref={ref}
			data-slot="cascader-separator"
			role="presentation"
			aria-hidden="true"
			className={cn(CASCADER_SEPARATOR_CLASS, className)}
			{...props}
		/>
	);
});

export { CascaderGroup, CascaderItem, CascaderItems, CascaderLabel, CascaderSeparator };
