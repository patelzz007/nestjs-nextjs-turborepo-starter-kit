"use client";

// The code block's line row (enhancement 8.1: split from code-block.tsx): number, diff mark, fold control and its tokens.

import { type CodeBlockLine, type CodeBlockLineActionsRender } from "@workspace/ui/components/code-block-highlight";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { type CodeBlockLabels, type CodeBlockLineActionsSide } from "./code-block-context";
import { type CodeBlockFoldRegion, CodeBlockTokens } from "./code-block-model";
import { LINE_CLASS } from "./code-block-styles";

export interface CodeBlockLineRowProps {
	readonly line: CodeBlockLine;
	readonly selectable: boolean;
	readonly selected: boolean;
	readonly focusMode: boolean;
	readonly active: boolean;
	readonly caret: boolean;
	readonly labels: CodeBlockLabels;
	readonly actions?: CodeBlockLineActionsRender | null | undefined;
	readonly actionsSide?: CodeBlockLineActionsSide | undefined;
	readonly domIdBase?: string | undefined;
	readonly startLine?: number | undefined;
	readonly onSelect?: ((line: number, extend: boolean) => void) | undefined;
	readonly foldable?: boolean | undefined;
	readonly foldRegion?: CodeBlockFoldRegion | undefined;
	readonly folded?: boolean | undefined;
	readonly onToggleFold?: ((start: number) => void) | undefined;
}

/* Shift-click is line-range selection here, but the browser also reads it as
   "extend the text selection", which paints a stray highlight across the
   block. Suppressing it only for the shift case leaves plain drag-to-select,
   and therefore copying, untouched. */
export function preventShiftSelection(event: React.MouseEvent): void {
	if (event.shiftKey) event.preventDefault();
}

/* An action is a control, not line content. Without this check the click
   reaches a selectable row and toggles the very selection the action just
   consumed, so "add these 6 lines" left line 6 selected behind it. The
   consumer's own handler has already run by here. (ReUI stopped propagation on
   the action group itself; the row filtering the click is equivalent for the
   selection and keeps a handler off the non-interactive group element.) */
export function isInsideLineActions(target: EventTarget): boolean {
	return target instanceof Element && target.closest('[data-slot="code-block-line-actions"]') !== null;
}

/**
 * Plain reference-equality `memo`, on purpose: the highlighter returns the
 * SAME object for an unchanged line, so a streamed chunk re-renders one row.
 * A custom comparator would spend that win walking every token.
 */
export const CodeBlockLineRow = React.memo(function CodeBlockLineRow({
	line,
	selectable,
	selected,
	focusMode,
	active,
	caret,
	labels,
	actions,
	actionsSide = "end",
	domIdBase,
	startLine = 1,
	onSelect,
	foldRegion,
	folded,
	onToggleFold,
}: CodeBlockLineRowProps): React.JSX.Element {
	const state = line.state;
	const blurred = focusMode && !state?.focused;
	const lineDomId = domIdBase ? `${domIdBase}-L${String(line.number)}` : undefined;
	const hiddenCount = foldRegion ? foldRegion.end - foldRegion.start : 0;
	/* The fold toggle owns the channel, so a fold-start row keeps its chevron
	   and sends the action back to the row end. */
	const inGutter = actionsSide === "gutter" && !foldRegion;
	const lineNumber = line.number;
	const regionStart = foldRegion?.start;

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLSpanElement>): void => {
			if (isInsideLineActions(event.target)) return;
			onSelect?.(lineNumber, event.shiftKey);
		},
		[onSelect, lineNumber],
	);

	/* The option semantics and the pointer handlers exist together or not at
	   all: a selectable row is a listbox option (focusable by
	   aria-activedescendant, hence tabIndex -1), a plain row is inert text. */
	const optionProps: React.HTMLAttributes<HTMLSpanElement> = selectable
		? {
				role: "option",
				"aria-selected": selected,
				tabIndex: -1,
				onMouseDown: preventShiftSelection,
				onClick: onSelect ? handleClick : undefined,
			}
		: {};

	/* The row itself may be a selection target, and a fold is not a
	   selection. The chip toggles the region by its SOURCE start, the same
	   value the chevron uses (ReUI passed the displayed number here, which
	   pointed at the wrong region whenever `startLine` was not 1). */
	const handleToggleFold = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.stopPropagation();
			if (regionStart !== undefined) onToggleFold?.(regionStart);
		},
		[onToggleFold, regionStart],
	);

	const rowStyle: React.CSSProperties = { counterReset: `cb-line ${String(line.number - 1)}` };
	const displayedFrom = foldRegion ? foldRegion.start + startLine - 1 : 0;
	const displayedTo = foldRegion ? foldRegion.end + startLine - 1 : 0;

	return (
		<span
			data-slot="code-block-line"
			data-code-line={line.number}
			data-gutter={line.gutter}
			id={lineDomId}
			data-active={active ? true : undefined}
			data-highlighted={state?.highlighted ? true : undefined}
			data-diff={state?.diff}
			data-focused={state?.focused ? true : undefined}
			data-blurred={blurred ? true : undefined}
			data-level={state?.level}
			data-selected={selected ? true : undefined}
			{...optionProps}
			className={cn(LINE_CLASS, selectable ? "cursor-pointer" : undefined)}
			/**
			 * Every row re-seeds the counter, making its number absolute rather
			 * than ordinal. That serves two features at once: folding can remove
			 * rows without renumbering the tail, and `content-visibility` can skip
			 * offscreen rows - a style-contained row cannot read a shared counter,
			 * which once rendered every gutter number as 1.
			 */
			style={rowStyle}>
			{foldRegion && onToggleFold ? (
				<button
					type="button"
					/* Inside a role="option" row a focusable descendant is invalid ARIA,
					   so the toggle leaves the tab order when the block is selectable;
					   pointer use is unaffected. */
					tabIndex={selectable ? -1 : undefined}
					data-slot="code-block-fold-toggle"
					data-state={folded ? "folded" : "unfolded"}
					aria-expanded={!folded}
					aria-label={folded ? labels.unfoldLines(displayedFrom, displayedTo) : labels.foldLines(displayedFrom, displayedTo)}
					onClick={handleToggleFold}
					className={cn(
						/* Styled as a ghost xs button rather than composed from Button:
						   the ghost variant paints aria-expanded:bg-muted, which would
						   keep every UNFOLDED toggle lit, and its icon rungs do not fit
						   an 18px channel. Hover feedback only; folded state reads
						   through color. */
						/* Square, centred in the line box: height matches the width and
						   the translate makes up the difference to the 24px line. Open
						   regions read darker than folded ones. */
						"sticky z-20 inline-flex size-(--code-block-fold-width) shrink-0 translate-y-[calc((var(--code-block-line-height)-var(--code-block-fold-width))/2)] cursor-pointer items-center justify-center rounded-lg align-top text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
						/* Margins cancel: -(4px + width) then +4px, so the toggle paints
						   in the channel, sits 4px from the code, and the code still
						   starts where a row without a toggle does. An uncancelled
						   margin slid every foldable row and clipped characters. The
						   spacing() shorthand is written as a rem literal because
						   `mr-(--spacing(1))` is not valid Tailwind and generates no
						   rule at all - measured live as a 4px drift. */
						"-ml-[calc(var(--code-block-fold-width)+0.25rem)]",
						"mr-1",
						"left-[calc(var(--code-block-gutter-width)-var(--code-block-fold-width)-0.25rem)]",
						folded ? "text-muted-foreground/60" : undefined,
					)}>
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
						<path d={folded ? "m9 18 6-6-6-6" : "m6 9 6 6 6-6"} />
					</svg>
				</button>
			) : null}
			{actions && active ? (
				<span
					data-slot="code-block-line-actions"
					data-side={inGutter ? "gutter" : "end"}
					contentEditable={false}
					className={cn(
						/* Inside the <pre>, so the code surface's mono face, pre
						   whitespace and token color would cascade into real buttons
						   placed here. Reset to app typography at the boundary. */
						"z-20 items-center gap-1 font-sans whitespace-normal text-foreground select-none",
						!inGutter ? "absolute inset-e-2 top-0 flex h-(--code-block-line-height)" : undefined,
						/* ABSOLUTE and centred on the row's START EDGE: `left-0` is where
						   the code column begins (the row box already excludes the
						   gutter), and the -50% translate hangs the control half over the
						   number column, half over the code - the editor treatment. Being
						   out of flow on BOTH axes is the point: an in-flow version
						   pushed the code right by its own width, and an earlier block
						   level one broke the row onto a new line. The control travels
						   with the code on a horizontal scroll; it cannot also be sticky. */
						inGutter ? "absolute top-1/2 left-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center" : undefined,
					)}>
					{actions({ line: line.number, text: line.text, state })}
				</span>
			) : null}
			<span data-slot="code-block-line-content">
				{/* An empty line needs an explicit break. Copying a selection relies on
				    the browser emitting a newline between block-level rows, and a row
				    with no text at all contributes neither text nor separator, so a
				    blank line silently vanishes from the pasted source. */}
				{line.tokens.length === 0 ? <br /> : null}
				<CodeBlockTokens tokens={line.tokens} />
				{folded && hiddenCount > 0 ? (
					/* `select-none` is doing real work: a manual drag-select over a
					   folded block would otherwise paste this chip into the middle of
					   the source. The copy button reads the raw code and never sees it. */
					<button
						type="button"
						tabIndex={selectable ? -1 : undefined}
						data-slot="code-block-fold-marker"
						aria-label={labels.unfoldHiddenLines(hiddenCount)}
						onClick={handleToggleFold}
						/* Same centring as the fold toggle: chip height matches the fold
						   channel and the translate makes up the difference to the line
						   box, so the label sits on the code baseline's visual centre
						   instead of riding high. */
						className="ml-2 inline-flex h-(--code-block-fold-width) translate-y-[calc((var(--code-block-line-height)-var(--code-block-fold-width))/2)] cursor-pointer items-center rounded-sm bg-muted/80 px-1.5 align-top text-[0.8em] leading-none text-muted-foreground select-none hover:bg-muted">
						{labels.hiddenLines(hiddenCount)}
					</button>
				) : null}
				{caret ? (
					<span
						data-slot="code-block-caret"
						aria-hidden="true"
						/* An underline caret: a thin strip on the baseline, the shape a
						   terminal uses, instead of a bold block that outweighs the text
						   it follows. */
						className="ml-0.5 inline-block h-[0.12em] w-[0.55em] translate-y-[0.02em] animate-pulse rounded-[1px] bg-(--code-block-caret-color) motion-reduce:animate-none"
					/>
				) : null}
			</span>
		</span>
	);
});

/* -------------------------------------------------------------------------- */
/*                                     Root                                    */
/* -------------------------------------------------------------------------- */
