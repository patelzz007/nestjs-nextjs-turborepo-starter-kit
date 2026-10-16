"use client";

import { defaultRangeExtractor, elementScroll, observeElementOffset, observeElementRect, Virtualizer } from "@tanstack/react-virtual";
import type { Range, VirtualItem, VirtualizerOptions } from "@tanstack/react-virtual";
import { CascaderColumnPanel } from "@workspace/ui/components/cascader/cascader-columns";
import { useCascaderActions, useCascaderHighlight, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import type { CascaderColumn } from "@workspace/ui/components/cascader/cascader-context";
import { CascaderItem, CascaderItems, getCascaderMoreProps } from "@workspace/ui/components/cascader/cascader-item";
import * as React from "react";

/**
 * Windowing for the cascader, in its own file so the primitive's base install
 * never pulls `@tanstack/react-virtual` in. Base UI forces three rules:
 *
 * 1. A windowed row MUST carry an explicit `index`.
 * 2. That index is DESTRUCTIVE while unvirtualized, so rows stay plain until
 *    the root flips `virtualized`, gated inside `CascaderItem`.
 * 3. No `Combobox.Collection` and no FUNCTION CHILD on `Combobox.List`: a
 *    Collection renders every filtered item.
 *
 * The virtualizer is TanStack's core `Virtualizer` class driven by a small
 * hook (`useCascaderVirtualizer`): its `useVirtualizer` returns functions the
 * React Compiler cannot memoise safely, which the repo's lint rejects.
 */

/* -------------------------------------------------------------------------- */
/*                                 Virtualizer                                */
/* -------------------------------------------------------------------------- */

/** Row height handed to the virtualizer before a row is measured, in pixels. */
export const CASCADER_ESTIMATE_ROW_SIZE_PX = 32;

/** Rows rendered beyond each edge of the viewport. */
export const CASCADER_OVERSCAN = 8;

export interface UseCascaderVirtualizerOptions {
	readonly count: number;
	readonly getScrollElement: () => HTMLElement | null;
	readonly estimateSize?: number | undefined;
	readonly overscan?: number | undefined;
	/** Key rows by node value, never by position: a tree expand shifts every position. */
	readonly getItemKey: (index: number) => string | number;
	/** Render index of the highlighted row, or `-1`. Pinned into the window. */
	readonly activeIndex?: number | undefined;
}

export type CascaderVirtualizer = Virtualizer<HTMLElement, HTMLElement>;

function sortAscending(left: number, right: number): number {
	return left - right;
}

function bumpVersion(version: number): number {
	return version + 1;
}

/**
 * The cascader's virtualizer: TanStack's core plus the highlight pinning and
 * scroll-into-view a combobox list needs. `activeIndex` is clamped here: it can
 * be one commit ahead of a level that just shrank.
 */
export function useCascaderVirtualizer({
	count,
	getScrollElement,
	estimateSize = CASCADER_ESTIMATE_ROW_SIZE_PX,
	overscan = CASCADER_OVERSCAN,
	getItemKey,
	activeIndex = -1,
}: UseCascaderVirtualizerOptions): CascaderVirtualizer {
	const active = activeIndex >= 0 && activeIndex < count ? activeIndex : -1;
	const [, rerender] = React.useReducer(bumpVersion, 0);

	// Keeps the highlighted row mounted so `aria-activedescendant` never dangles.
	const rangeExtractor = React.useCallback(
		(range: Range): number[] => {
			const indices = new Set(defaultRangeExtractor(range));
			if (active !== -1) {
				indices.add(active);
			}
			return Array.from(indices).sort(sortAscending);
		},
		[active],
	);

	const measureEstimate = React.useCallback((): number => estimateSize, [estimateSize]);

	const options = React.useMemo(
		(): VirtualizerOptions<HTMLElement, HTMLElement> => ({
			count,
			getScrollElement,
			estimateSize: measureEstimate,
			overscan,
			getItemKey,
			rangeExtractor,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: (): void => {
				rerender();
			},
		}),
		[count, getScrollElement, measureEstimate, overscan, getItemKey, rangeExtractor],
	);

	const [virtualizer] = React.useState((): CascaderVirtualizer => new Virtualizer(options));
	// The options of THIS render, before anything reads the window: a level that shrank must not render rows it no longer has.
	virtualizer.setOptions(options);

	React.useLayoutEffect((): (() => void) => virtualizer._didMount(), [virtualizer]);
	React.useLayoutEffect((): void => {
		virtualizer._willUpdate();
	});

	// Base UI's scroll-into-view no-ops on a windowed-out row.
	React.useEffect((): void => {
		if (active !== -1) {
			virtualizer.scrollToIndex(active, { align: "auto" });
		}
	}, [active, count, virtualizer]);

	return virtualizer;
}

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

interface CascaderVirtualGutter {
	readonly block: number;
	readonly inline: number;
}

interface CascaderVirtualContent {
	readonly element: HTMLElement | null;
	readonly gutter: CascaderVirtualGutter;
}

const NO_CONTENT: CascaderVirtualContent = { element: null, gutter: { block: 0, inline: 0 } };

/** A computed padding, in pixels; an unparsable one is no padding. */
function readPadding(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The ROWS' BOX and its own padding: a windowed row is positioned against this
 * box's PADDING box while the spacer is an in-flow child of its CONTENT box, so
 * without the padding rows sit flush. Measured from the spacer's ref callback.
 */
function useCascaderVirtualContent(): readonly [CascaderVirtualContent, (spacer: HTMLElement | null) => void] {
	const [content, setContent] = React.useState<CascaderVirtualContent>(NO_CONTENT);
	const attach = React.useCallback((spacer: HTMLElement | null): void => {
		const element = spacer?.parentElement ?? null;
		if (element === null) {
			return;
		}
		const styles = getComputedStyle(element);
		const gutter = { block: readPadding(styles.paddingTop), inline: readPadding(styles.paddingInlineStart || styles.paddingLeft) };
		setContent((previous: CascaderVirtualContent): CascaderVirtualContent =>
			previous.element === element && previous.gutter.block === gutter.block && previous.gutter.inline === gutter.inline ? previous : { element, gutter },
		);
	}, []);
	return [content, attach];
}

/** Logical insets, not `left` / `width`, so RTL needs no second code path. */
function cascaderVirtualRowStyle(start: number, gutter: CascaderVirtualGutter): React.CSSProperties {
	return { position: "absolute", top: 0, insetInlineStart: gutter.inline, insetInlineEnd: gutter.inline, transform: `translateY(${String(start + gutter.block)}px)` };
}

/** The element that actually SCROLLS: the `ScrollArea` viewport above the rows' box, falling back to the box for a hand-written scroller. */
function cascaderScrollElement(content: HTMLElement | null): HTMLElement | null {
	if (content === null) {
		return null;
	}
	return content.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? content;
}

interface CascaderVirtualSpacerProps {
	readonly height: number;
	readonly onAttach: (spacer: HTMLElement | null) => void;
}

/** `role="presentation"` keeps the listbox owning nothing but options; its parent IS the rows' box. */
function CascaderVirtualSpacer({ height, onAttach }: CascaderVirtualSpacerProps): React.JSX.Element {
	const style = React.useMemo((): React.CSSProperties => ({ height }), [height]);
	return <div ref={onAttach} role="presentation" data-slot="cascader-virtual-spacer" style={style} />;
}

/* -------------------------------------------------------------------------- */
/*                                    Rows                                    */
/* -------------------------------------------------------------------------- */

export interface CascaderVirtualItemsProps {
	/** Row height before measurement. Defaults to the root `estimateRowSize`. */
	readonly estimateSize?: number | undefined;
	/** Rows rendered beyond each edge. Defaults to the root `overscan`. */
	readonly overscan?: number | undefined;
}

/**
 * Windowed replacement for `CascaderItems`, dropped inside `CascaderList`. It
 * registers in a LAYOUT effect because the root derives `virtualized` from it;
 * until the root has seen it, this renders exactly what `CascaderItems` does.
 * Rows only — no element of its own to forward a ref to.
 */
function CascaderVirtualItems(props: CascaderVirtualItemsProps): React.JSX.Element {
	const { virtualized, registerVirtualRenderer } = useCascaderActions();

	React.useLayoutEffect((): (() => void) => registerVirtualRenderer(), [registerVirtualRenderer]);

	if (!virtualized) {
		return <CascaderItems />;
	}

	return <CascaderVirtualRows {...props} />;
}

function CascaderVirtualRows({ estimateSize, overscan }: CascaderVirtualItemsProps): React.JSX.Element {
	const { estimateRowSize, overscan: rootOverscan, mode, isBranch, isSelectable, isSelected, isIndeterminate } = useCascaderActions();
	const { renderedItems, treeRows, deepResults, loadStates } = useCascaderState();
	// Re-renders on every highlight change, and has to: the pinned row and the scroll target are derived from it.
	const highlight = useCascaderHighlight();
	const [content, attach] = useCascaderVirtualContent();

	const tree = mode === "tree";
	const count = tree ? treeRows.length : renderedItems.length;
	const showPath = !tree && deepResults !== null;

	const getItemKey = React.useCallback(
		(position: number): string | number => (tree ? treeRows.at(position)?.node.value : renderedItems.at(position)?.value) ?? position,
		[tree, treeRows, renderedItems],
	);
	const contentElement = content.element;
	const getScrollElement = React.useCallback((): HTMLElement | null => cascaderScrollElement(contentElement), [contentElement]);

	const virtualizer = useCascaderVirtualizer({
		count,
		getScrollElement,
		estimateSize: estimateSize ?? estimateRowSize,
		overscan: overscan ?? rootOverscan,
		getItemKey,
		activeIndex: highlight.index,
	});

	return (
		<>
			<CascaderVirtualSpacer height={virtualizer.getTotalSize()} onAttach={attach} />
			{virtualizer.getVirtualItems().map((row: VirtualItem): React.JSX.Element | null => {
				const flat = tree ? treeRows.at(row.index) : undefined;
				const node = tree ? flat?.node : renderedItems.at(row.index);
				// For one commit after a query narrows the level, the window can name a row it no longer has.
				if (node === undefined) {
					return null;
				}
				return (
					<CascaderItem
						key={row.key}
						// Measured, not estimated: rows are two lines with a `description` and three in deep search.
						ref={virtualizer.measureElement}
						measureIndex={row.index}
						style={cascaderVirtualRowStyle(row.start, content.gutter)}
						node={node}
						index={row.index}
						depth={flat?.depth}
						expanded={flat?.expanded}
						branch={flat === undefined ? isBranch(node) : flat.branch}
						selectable={isSelectable(node)}
						selected={isSelected(node)}
						indeterminate={isIndeterminate(node)}
						{...getCascaderMoreProps(node, loadStates)}
						showPath={showPath}
						aria-setsize={flat === undefined ? count : flat.setSize}
						aria-posinset={flat === undefined ? row.index + 1 : flat.posInSet}
					/>
				);
			})}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Column                                   */
/* -------------------------------------------------------------------------- */

export interface CascaderVirtualColumnProps extends CascaderVirtualItemsProps {
	readonly column: CascaderColumn;
}

/**
 * Windowed replacement for one Miller column, passed through the
 * `CascaderColumns` render slot. One virtualizer PER COLUMN; the trail behind
 * the active column windows on its own row count.
 */
const CascaderVirtualColumn = React.forwardRef<HTMLDivElement, CascaderVirtualColumnProps>(function CascaderVirtualColumn(
	{ column, estimateSize, overscan },
	ref,
): React.JSX.Element {
	const { virtualized, registerVirtualRenderer, virtualize, virtualizeThreshold } = useCascaderActions();

	React.useLayoutEffect((): (() => void) => registerVirtualRenderer(), [registerVirtualRenderer]);

	const windowed = column.active ? virtualized : (virtualize ?? column.items.length >= virtualizeThreshold);

	if (!windowed) {
		return <CascaderColumnPanel ref={ref} column={column} />;
	}

	return (
		<CascaderColumnPanel ref={ref} column={column} virtualized>
			{column.active ? (
				<CascaderVirtualActiveColumnRows column={column} estimateSize={estimateSize} overscan={overscan} />
			) : (
				<CascaderVirtualColumnRows column={column} estimateSize={estimateSize} overscan={overscan} activeIndex={-1} />
			)}
		</CascaderColumnPanel>
	);
});

/** Only the active column subscribes to the highlight; a trail column must not. */
function CascaderVirtualActiveColumnRows(props: CascaderVirtualColumnProps): React.JSX.Element {
	const highlight = useCascaderHighlight();
	return <CascaderVirtualColumnRows {...props} activeIndex={highlight.index} />;
}

interface CascaderVirtualColumnRowsProps extends CascaderVirtualColumnProps {
	readonly activeIndex: number;
}

function CascaderVirtualColumnRows({ column, estimateSize, overscan, activeIndex }: CascaderVirtualColumnRowsProps): React.JSX.Element {
	const { estimateRowSize, overscan: rootOverscan, baseId, isBranch, isSelectable, isSelected, isIndeterminate } = useCascaderActions();
	const { loadStates } = useCascaderState();
	const [content, attach] = useCascaderVirtualContent();

	const { items } = column;
	const getItemKey = React.useCallback((position: number): string | number => items.at(position)?.value ?? position, [items]);
	const contentElement = content.element;
	const getScrollElement = React.useCallback((): HTMLElement | null => cascaderScrollElement(contentElement), [contentElement]);

	const virtualizer = useCascaderVirtualizer({
		count: items.length,
		getScrollElement,
		estimateSize: estimateSize ?? estimateRowSize,
		overscan: overscan ?? rootOverscan,
		getItemKey,
		activeIndex,
	});

	return (
		<>
			<CascaderVirtualSpacer height={virtualizer.getTotalSize()} onAttach={attach} />
			{virtualizer.getVirtualItems().map((row: VirtualItem): React.JSX.Element | null => {
				const node = items.at(row.index);
				if (node === undefined) {
					return null;
				}
				const open = node.value === column.activeValue;
				return (
					<CascaderItem
						key={row.key}
						ref={virtualizer.measureElement}
						measureIndex={row.index}
						style={cascaderVirtualRowStyle(row.start, content.gutter)}
						node={node}
						as={column.active ? "option" : "button"}
						depth={column.depth}
						branch={isBranch(node)}
						selectable={isSelectable(node)}
						selected={isSelected(node)}
						indeterminate={isIndeterminate(node)}
						{...getCascaderMoreProps(node, loadStates)}
						open={open}
						// Only the listbox column may carry an index or listbox metadata.
						index={column.active ? row.index : undefined}
						aria-setsize={column.active ? items.length : undefined}
						aria-posinset={column.active ? row.index + 1 : undefined}
						aria-expanded={!column.active && open ? true : undefined}
						aria-controls={!column.active && open ? `${baseId}-column-${String(column.depth + 1)}` : undefined}
					/>
				);
			})}
		</>
	);
}

export { CascaderVirtualColumn, CascaderVirtualItems };
