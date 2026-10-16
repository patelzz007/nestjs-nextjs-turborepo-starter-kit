"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { isNumberPrimitive } from "@workspace/shared";
import { useCascaderActions, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import type { CascaderColumn } from "@workspace/ui/components/cascader/cascader-context";
import { CascaderItem, getCascaderMoreProps } from "@workspace/ui/components/cascader/cascader-item";
import {
	CASCADER_LIST_HEIGHT_CLASS,
	CASCADER_LIST_PAD_CLASS,
	CASCADER_ROOT_KEY,
	CASCADER_ROWS_CLASS,
	CASCADER_SCROLL_CLASS,
	focusCascaderHome,
} from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";
import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

/** Default width of one Miller column, in pixels. */
export const CASCADER_COLUMN_WIDTH_PX = 220;

/** CSS custom properties are kebab-case by spec, so the keys are declared via `Record`. */
type CascaderColumnsStyle = React.CSSProperties & Readonly<Record<"--cascader-column-width", string>> & Partial<Readonly<Record<"--cascader-max-height", string>>>;

/** A number is pixels; a string is any CSS length. */
export function toCascaderCssLength(value: number | string): string {
	return isNumberPrimitive(value) ? `${String(value)}px` : value;
}

export interface CascaderColumnsProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	/** Width of each column. A number is pixels. */
	readonly columnWidth?: number | string | undefined;
	/** Height CAP per column. Falls back to the root `maxHeight`, then 24rem. */
	readonly maxHeight?: number | string | undefined;
	/** Replaces the default panel; the seam a windowed column plugs into. */
	readonly children?: ((column: CascaderColumn) => React.ReactNode) | undefined;
}

/**
 * Miller columns: the open trail side by side, one panel per level. Only the
 * DEEPEST column is a real listbox (Base UI owns exactly one list); the trail
 * behind is plain buttons, which keeps one state machine instead of a second,
 * 2D one. `CascaderInput` moves between columns with the level keys.
 * Renders nothing outside `mode="columns"`.
 */
const CascaderColumns = React.forwardRef<HTMLDivElement, CascaderColumnsProps>(function CascaderColumns(
	{ className, columnWidth = CASCADER_COLUMN_WIDTH_PX, maxHeight: maxHeightProp, children, style, ...props },
	ref,
): React.JSX.Element | null {
	const { maxHeight, mode, labels } = useCascaderActions();
	const { columns } = useCascaderState();
	const height = maxHeightProp ?? maxHeight;

	const columnsStyle = React.useMemo((): CascaderColumnsStyle => {
		const base: CascaderColumnsStyle = { ...style, "--cascader-column-width": toCascaderCssLength(columnWidth) };
		// Set only from an EXPLICIT cap: unset means "24rem or what the viewport leaves", via the `min()` fallback.
		return height === undefined ? base : { ...base, "--cascader-max-height": toCascaderCssLength(height) };
	}, [style, columnWidth, height]);

	if (mode !== "columns") {
		return null;
	}

	return (
		<div
			ref={ref}
			data-slot="cascader-columns"
			role="group"
			aria-label={labels.columnsLabel}
			style={columnsStyle}
			className={cn("flex max-h-full min-h-0 items-stretch overflow-x-auto overscroll-x-contain", CASCADER_LIST_PAD_CLASS, className)}
			{...props}>
			{columns.map((column: CascaderColumn): React.JSX.Element =>
				children === undefined ? <CascaderColumnPanel key={column.depth} column={column} /> : <React.Fragment key={column.depth}>{children(column)}</React.Fragment>,
			)}
		</div>
	);
});

/**
 * One column's box. `columnWidth` is the width of the LIST, so bordered
 * columns are widened by their 1px divider. The box is also the BOUND, the
 * same `min(--available-height, cap)` the single list uses.
 */
const PANEL_CLASS = `flex w-(--cascader-column-width) shrink-0 flex-col overscroll-contain not-first:w-[calc(var(--cascader-column-width)+1px)] not-first:border-s not-first:border-border/60 ${CASCADER_LIST_HEIGHT_CLASS}`;

const COLUMN_LOADING_ICON = <LoaderCircleIcon aria-hidden className="size-3.5 motion-safe:animate-spin" />;

export interface CascaderColumnPanelProps {
	readonly column: CascaderColumn;
	/** Replaces the panel's rows; the empty state still wins on an empty column. */
	readonly children?: React.ReactNode;
	/** Containing block for the windowed column's absolutely positioned rows. */
	readonly virtualized?: boolean | undefined;
	readonly className?: string | undefined;
}

function resolveColumnState(loadState: { readonly loading: boolean; readonly error: boolean } | undefined): "error" | "loading" | "empty" {
	if (loadState?.error === true) {
		return "error";
	}
	return loadState?.loading === true ? "loading" : "empty";
}

/** One Miller column: a listbox when it is the deepest, a named group of trail buttons otherwise. */
const CascaderColumnPanel = React.forwardRef<HTMLDivElement, CascaderColumnPanelProps>(function CascaderColumnPanel(
	{ column, children, virtualized = false, className },
	ref,
): React.JSX.Element {
	const { labels, baseId, isBranch, isSelectable, isSelected, isIndeterminate, retryLevel, searchScope } = useCascaderActions();
	const { loadStates, deepResults } = useCascaderState();

	// Keyed per level, not one global flag: columns load and land independently.
	const columnKey = column.parent?.value ?? CASCADER_ROOT_KEY;
	const loadState = loadStates.get(columnKey);
	const emptyState = resolveColumnState(loadState);

	const handleRetry = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// A trail column can hold focus, and the loading state unmounts this button.
			focusCascaderHome(event.currentTarget);
			retryLevel(columnKey);
		},
		[retryLevel, columnKey],
	);

	let emptyBody: React.ReactNode = labels.empty;
	if (emptyState === "error") {
		emptyBody = (
			<>
				{labels.error}{" "}
				<button
					type="button"
					data-slot="cascader-retry"
					onClick={handleRetry}
					className="rounded-md px-1 font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50">
					{labels.retry}
				</button>
			</>
		);
	} else if (emptyState === "loading") {
		emptyBody = (
			<span className="flex items-center gap-1.5">
				{COLUMN_LOADING_ICON}
				{labels.loading}
			</span>
		);
	}

	const rows =
		column.items.length === 0 ? (
			<p data-slot="cascader-column-empty" data-state={emptyState} className="px-2 py-1.5 text-sm text-muted-foreground">
				{emptyBody}
			</p>
		) : (
			(children ??
			column.items.map((node: CascaderNodeBase, position: number): React.JSX.Element => {
				const open = node.value === column.activeValue;
				return (
					<CascaderItem
						key={node.value}
						node={node}
						// A trail row must not compete for `aria-activedescendant`.
						as={column.active ? "option" : "button"}
						depth={column.depth}
						branch={isBranch(node)}
						selectable={isSelectable(node)}
						selected={isSelected(node)}
						indeterminate={isIndeterminate(node)}
						{...getCascaderMoreProps(node, loadStates)}
						open={open}
						// Set metadata is option-only; a trail row is a `role="button"`.
						aria-setsize={column.active ? column.items.length : undefined}
						aria-posinset={column.active ? position + 1 : undefined}
						aria-expanded={!column.active && open ? true : undefined}
						aria-controls={!column.active && open ? `${baseId}-column-${String(column.depth + 1)}` : undefined}
					/>
				);
			}))
		);

	// Global hits come from the whole tree, so the parent would understate them.
	const columnName = column.active && searchScope === "global" && deepResults !== null ? labels.rootLevel : (column.parent?.label ?? labels.rootLevel);
	const columnId = `${baseId}-column-${String(column.depth)}`;
	// A windowed row is absolutely positioned, so the ROWS' box is the containing block.
	const rowsClass = cn(CASCADER_ROWS_CLASS, virtualized ? "relative" : undefined);

	// The active column IS the Combobox list: only rows inside `Combobox.List` reach arrow-key navigation and `aria-activedescendant`.
	const body = column.active ? (
		<ComboboxPrimitive.List
			data-slot="cascader-column"
			data-active=""
			data-depth={column.depth}
			data-virtualized={virtualized ? "" : undefined}
			id={columnId}
			aria-label={columnName}
			className={rowsClass}>
			{rows}
		</ComboboxPrimitive.List>
	) : (
		// A named `group`, not a second listbox competing with the active column.
		<div
			data-slot="cascader-column"
			data-depth={column.depth}
			data-virtualized={virtualized ? "" : undefined}
			id={columnId}
			aria-label={columnName}
			role="group"
			className={rowsClass}>
			{rows}
		</div>
	);

	return (
		<div ref={ref} data-slot="cascader-column-bounds" data-active={column.active ? "" : undefined} data-depth={column.depth} className={cn(PANEL_CLASS, className)}>
			<ScrollArea className={CASCADER_SCROLL_CLASS}>{body}</ScrollArea>
		</div>
	);
});

export { CascaderColumnPanel, CascaderColumns };
