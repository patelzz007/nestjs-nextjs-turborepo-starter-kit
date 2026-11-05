"use client";

// The code block's content and scroll surface (enhancement 8.1: split from code-block.tsx).

import { LIST_SLOT_INDEX } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { type CodeBlockSurfaceProps, CodeBlockSurfacePropsContext, useIsoLayoutEffect } from "./code-block-context";
import { CodeBlockLineRow } from "./code-block-line";
import { MIN_GUTTER_DIGITS, OVERFLOW_TOLERANCE_PX, STICK_TO_BOTTOM_THRESHOLD_PX, TOKEN_COLOR_CLASS } from "./code-block-styles";

export interface CodeBlockContentProps {
	className?: string;
}

/**
 * The code surface as a composable part: inside your own ScrollArea the block
 * stops scrolling internally and the ancestor owns both axes (`maxLines`'
 * height cap no longer applies). Omitted, the root renders the same surface
 * itself, exactly as before.
 */
export const CodeBlockContent = React.forwardRef<HTMLDivElement, CodeBlockContentProps>(function CodeBlockContent({ className }, ref): React.JSX.Element {
	const surface = React.useContext(CodeBlockSurfacePropsContext);
	if (!surface) {
		throw new Error("CodeBlockContent must be used within a CodeBlock");
	}

	/* The render-time walk cannot see through a consumer's own component
	   boundary; when that happens the root also renders its built-in surface
	   and the code appears twice. Silent double content is the worst failure
	   mode, so development says exactly what to do. */
	const builtInSurfaceRendered = surface.builtInSurfaceRendered;
	React.useEffect(() => {
		if (process.env.NODE_ENV === "production") return;
		if (builtInSurfaceRendered) {
			console.error(
				"CodeBlockContent is hidden behind a component boundary, so CodeBlock " +
					"also rendered its built-in surface and the code appears twice. " +
					"Compose <CodeBlockContent /> directly in the CodeBlock's children " +
					"(plain wrappers like a ScrollArea are fine).",
			);
		}
	}, [builtInSurfaceRendered]);

	return <CodeBlockSurface ref={ref} {...surface} scroll={false} className={className} />;
});

export interface ElementWithChildrenProps {
	children?: React.ReactNode;
}

/**
 * Sees through plain element wrappers (a ScrollArea, a div) but not through a
 * consumer's own component boundary - unrendered children are opaque. Compose
 * `CodeBlockContent` directly in the block's subtree.
 */
export function containsElementType(node: React.ReactNode, type: object): boolean {
	for (const child of React.Children.toArray(node)) {
		if (!React.isValidElement<ElementWithChildrenProps>(child)) continue;
		if (child.type === type) return true;
		const inner = child.props.children;
		if (inner && containsElementType(inner, type)) return true;
	}
	return false;
}

/* -------------------------------------------------------------------------- */
/*                                   Surface                                   */
/* -------------------------------------------------------------------------- */

export type SurfaceStyle = React.CSSProperties & Record<"--code-block-gutter-width", string>;
export type ViewportStyle = React.CSSProperties & Record<"--cb-max-height", string>;

export function isScrollableOverflow(value: string): boolean {
	return value === "auto" || value === "scroll" || value === "overlay";
}

export function overflowsVertically(element: Element): boolean {
	return element.scrollHeight > element.clientHeight + OVERFLOW_TOLERANCE_PX;
}

export function distanceFromBottom(element: Element): number {
	return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export const CodeBlockSurface = React.forwardRef<HTMLDivElement, CodeBlockSurfaceProps>(function CodeBlockSurface(
	{
		lines,
		wrap,
		startLine,
		showLineNumbers,
		focusMode,
		selectable,
		selectedSet,
		toggleLine,
		visibleLines,
		gutterMax,
		foldable,
		gutterChannel,
		actionsSide,
		foldStarts,
		foldedSet,
		onToggleFold,
		expandClearance,
		streaming,
		label,
		labels,
		contentId,
		actions,
		completeAnnouncement,
		scroll = true,
		className,
	},
	ref,
): React.JSX.Element {
	const viewportRef = React.useRef<HTMLDivElement | null>(null);
	const preRef = React.useRef<HTMLPreElement | null>(null);
	const [activeLine, setActiveLine] = React.useState<number | null>(null);
	const stickRef = React.useRef(true);

	/* Stick-to-bottom disengages the moment the reader scrolls up, and re-engages
	   when they come back. Reading the scroll position on the event is enough
	   here because nothing is written back during the same frame. */
	/* Announced once when a stream ends, so a screen reader learns the code is
	   complete without hearing it assembled character by character. Derived
	   while rendering from the previous `streaming` value (React's "adjust
	   state on a prop change" pattern) rather than set from an effect, which
	   would cost a second commit for the same result. */
	const [announcement, setAnnouncement] = React.useState("");
	const [wasStreaming, setWasStreaming] = React.useState(streaming);
	if (wasStreaming !== streaming) {
		setWasStreaming(streaming);
		if (wasStreaming) {
			setAnnouncement(completeAnnouncement ?? labels.complete(lines.length));
		}
	}

	/* Stick-to-bottom follows whichever element ACTUALLY scrolls - writing
	   scrollTop to the composed mode's inert viewport was a silent no-op.
	   Resolved per commit: a short block becomes its own scroller the moment
	   it outgrows its cap. */
	const resolveScroller = React.useCallback((): Element | null => {
		const viewport = viewportRef.current;
		if (!viewport) return null;
		if (overflowsVertically(viewport)) return viewport;

		let node: HTMLElement | null = viewport.parentElement;
		while (node && node !== document.body) {
			if (isScrollableOverflow(getComputedStyle(node).overflowY) && overflowsVertically(node)) {
				return node;
			}
			node = node.parentElement;
		}

		/* An AI transcript's default shape scrolls the PAGE. The walk above never
		   reaches the root elements, so without this branch the stream wrote
		   scrollTop to an inert viewport and drifted off screen. */
		const page = document.scrollingElement;
		if (page && overflowsVertically(page)) return page;

		return viewport;
	}, []);

	const handleScroll = React.useCallback((): void => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		stickRef.current = distanceFromBottom(viewport) < STICK_TO_BOTTOM_THRESHOLD_PX;
	}, []);

	/* The ancestor case needs its own listener: the reader's intent has to be
	   recorded BEFORE the next chunk grows the content, or the distance already
	   includes what just arrived. Re-attached per chunk rather than diffed,
	   which is a handful of listener swaps a second and keeps this correct when
	   the scrolling element changes underneath. */
	const lineCount = lines.length;
	React.useEffect(() => {
		if (!streaming || lineCount < 0) return;
		const scroller = resolveScroller();
		if (!scroller || scroller === viewportRef.current) return;

		const onScroll = (): void => {
			stickRef.current = distanceFromBottom(scroller) < STICK_TO_BOTTOM_THRESHOLD_PX;
		};

		/* Page scrolls fire on window, not on the scrolling element. */
		const target: EventTarget = scroller === document.scrollingElement ? window : scroller;
		target.addEventListener("scroll", onScroll, { passive: true });
		return (): void => {
			target.removeEventListener("scroll", onScroll);
		};
	}, [streaming, lineCount, resolveScroller]);

	useIsoLayoutEffect(() => {
		if (!streaming || !stickRef.current || lines.length < 0) return;
		const scroller = resolveScroller();
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	}, [lines, streaming, resolveScroller]);

	/* One listener for the whole surface rather than a handler per line: the
	   active row is resolved from the event target, so the floating action group
	   costs one element no matter how long the file is. Focus is tracked as well
	   as hover, or the actions would be unreachable without a pointer. */
	const tracksActive = Boolean(actions) || selectable;
	const trackActive = React.useCallback(
		(event: Event): void => {
			if (!tracksActive) return;
			const target = event.target;
			const row = target instanceof Element ? target.closest("[data-code-line]") : null;
			const value = row?.getAttribute("data-code-line");

			/* No row under the pointer means the gutter, which lives in the <pre>'s
			   PADDING and so is covered by no row element. Keep the active line
			   rather than clearing it: clearing here unmounted a gutter action the
			   moment the pointer left the code toward it, so the control vanished
			   before it could be pressed. `onPointerLeave` still clears on exit. */
			if (!value) return;
			setActiveLine(Number(value));
		},
		[tracksActive],
	);

	const clearActive = React.useCallback((): void => {
		setActiveLine(null);
	}, []);

	/* Rows and keyboard speak DISPLAYED numbers (the gutter, data-code-line);
	   selection state speaks SOURCE numbers like every other line spec. This is
	   the one conversion point between them. */
	const toggleDisplayed = React.useCallback(
		(displayed: number, extend: boolean): void => {
			toggleLine(displayed - startLine + 1, extend);
		},
		[toggleLine, startLine],
	);

	const handleKeyDown = React.useCallback(
		(event: KeyboardEvent): void => {
			if (!selectable) return;

			if (event.key === "Escape") {
				setActiveLine(null);
				return;
			}

			/* Toggle IN PLACE. Shift+Arrow selects while moving, but without this a
			   keyboard user could never deselect a single line. */
			if ((event.key === "Enter" || event.key === " ") && activeLine !== null) {
				event.preventDefault();
				toggleDisplayed(activeLine, event.shiftKey);
				return;
			}

			const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
			if (!isArrow && event.key !== "Home" && event.key !== "End") return;
			event.preventDefault();

			/* Step by RENDERED index, not by number arithmetic: folding removes
			   rows, and numeric stepping walked the active line into hidden lines
			   where it silently vanished. */
			let next: number;
			if (event.key === "Home") {
				next = lines[LIST_SLOT_INDEX.first]?.number ?? startLine;
			} else if (event.key === "End") {
				next = lines.at(-1)?.number ?? startLine;
			} else {
				const step = event.key === "ArrowDown" ? 1 : -1;
				const index = lines.findIndex((line) => line.number === activeLine);
				const firstIndex = step === 1 ? 0 : lines.length - 1;
				const nextIndex = index === -1 ? firstIndex : Math.min(lines.length - 1, Math.max(0, index + step));
				next = lines[nextIndex]?.number ?? startLine;
			}

			setActiveLine(next);
			const row = preRef.current?.querySelector<HTMLElement>(`[data-code-line="${String(next)}"]`);
			/* `scrollIntoView` is missing from some non-browser DOMs (jsdom). */
			if (row && "scrollIntoView" in row) row.scrollIntoView({ block: "nearest" });
			if (isArrow && event.shiftKey) toggleDisplayed(next, true);
		},
		[selectable, lines, startLine, activeLine, toggleDisplayed],
	);

	/* Attached natively rather than as JSX handlers: the pre is a text block and
	   the viewport a scroll region, neither an interactive control in its own
	   right. These listeners only TRACK the pointer/focus position and drive
	   the listbox's active option (aria-activedescendant); every actionable
	   element inside is a real button or a listbox option. `focusin` is what
	   React's bubbling `onFocus` is built on. */
	React.useEffect(() => {
		const pre = preRef.current;
		if (!pre) return;
		pre.addEventListener("pointerover", trackActive);
		pre.addEventListener("focusin", trackActive);
		pre.addEventListener("pointerleave", clearActive);
		return (): void => {
			pre.removeEventListener("pointerover", trackActive);
			pre.removeEventListener("focusin", trackActive);
			pre.removeEventListener("pointerleave", clearActive);
		};
	}, [trackActive, clearActive]);

	React.useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		viewport.addEventListener("keydown", handleKeyDown);
		return (): void => {
			viewport.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown]);

	const lastLineNumber = lines.at(-1)?.number;

	/* `startLine` is just a counter reset. Gutter width follows the widest
	   number in the DOCUMENT (not the folded view, or folding the tail would
	   shift every row); `ch` is one digit in the mono `pre`, and the floor of 2
	   stops the column twitching as a stream crosses line 9. Lines carrying
	   their own gutter label (a patch's dual numbers) widen it to the longest
	   label instead. */
	const gutterDigits = Math.max(MIN_GUTTER_DIGITS, String(gutterMax).length, ...lines.map((line) => line.gutter?.length ?? 0));

	const surfaceStyle: SurfaceStyle = {
		"--code-block-gutter-width": gutterChannel
			? `calc(${String(gutterDigits)}ch + var(--code-block-fold-width) + var(--code-block-gutter-gap) + var(--code-block-padding))`
			: `calc(${String(gutterDigits)}ch + var(--code-block-gutter-gap) + var(--code-block-padding))`,
		counterReset: `cb-line ${String(startLine - 1)}`,
	};

	const cappedLines = scroll && visibleLines ? visibleLines : undefined;
	const viewportStyle: ViewportStyle | undefined =
		cappedLines !== undefined ? { "--cb-max-height": `calc(${String(cappedLines)} * var(--code-block-line-height) + 2 * var(--code-block-padding))` } : undefined;

	return (
		<div ref={ref} data-slot="code-block-content" className={cn("relative min-w-0 rounded-[inherit]", scroll ? "flex-1 overflow-hidden" : undefined)}>
			{/* Clipping above is the scroll-mode contract only: composed, a clipped
			    pre would hide its own width from the ancestor's viewport and the
			    horizontal scrollbar would never render. */}
			{/* A polite status, deliberately NOT an aria-live region on the code
			    itself: a live region over streaming code narrates every token. */}
			<span role="status" aria-live="polite" className="sr-only">
				{announcement}
			</span>
			{/* A plain overflow container, deliberately not a ScrollArea primitive.
			    The scroll must stay INSIDE the block (the sticky gutter, the
			    stick-to-bottom stream and `maxLines` all anchor to it), but nothing
			    here needs custom scrollbar machinery, and dropping it leaves the
			    block with no UI-library dependency at all - which is why both twins
			    are the same file. Compose Card, Frame, or your own ScrollArea
			    around the block for outer framing. */}
			<div
				ref={viewportRef}
				data-slot="code-block-viewport"
				id={contentId}
				role="region"
				aria-label={label}
				aria-busy={streaming ? true : undefined}
				/* Keyboard scrolling needs a focusable region — unless the block is
				   selectable, where the listbox below takes focus (and scrolls). */
				tabIndex={selectable ? undefined : 0}
				onScroll={handleScroll}
				className={cn(
					"relative min-w-0 rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
					/* Composed under an ancestor scroller the surface scrolls NOTHING
					   itself: both axes belong to the ancestor, whose viewport picks up
					   the pre's overflowing width, and the sticky number cell anchors
					   to that viewport instead. Mixed ownership shipped once and read
					   as two scrollbar styles on one block. */
					scroll ? "scrollbar-thin overflow-auto" : undefined,
					cappedLines !== undefined ? "max-h-(--cb-max-height)" : undefined,
					className,
				)}
				style={viewportStyle}>
				<pre
					ref={preRef}
					dir="ltr"
					data-code-line-numbers={showLineNumbers ? true : undefined}
					data-wrap={wrap ? true : undefined}
					role={selectable ? "listbox" : undefined}
					data-selectable={selectable ? true : undefined}
					aria-multiselectable={selectable ? true : undefined}
					/* The listbox owns the focus and its active option, so assistive
					   technology announces the line the arrow keys moved to. */
					tabIndex={selectable ? 0 : undefined}
					aria-activedescendant={selectable && activeLine !== null ? `${contentId}-L${String(activeLine)}` : undefined}
					aria-label={selectable ? labels.lines(label) : undefined}
					className={cn(
						"w-max min-w-full py-(--code-block-padding) font-mono text-(length:--code-block-font-size)",
						TOKEN_COLOR_CLASS,
						/* `min-w-0` must beat the `min-w-full` above, or the pre keeps
						   a floor of 100% of a scroll container that is itself wider
						   than the viewport, and wrapping still leaves a stray
						   horizontal scrollbar. */
						wrap ? "w-full max-w-full min-w-0 wrap-break-word whitespace-pre-wrap" : undefined,
						showLineNumbers ? "pl-(--code-block-gutter-width)" : undefined,
						/* The expand control floats over the surface in BOTH states, so
						   an expanded block reserves a row of clearance rather than
						   growing a bordered footer under the code. */
						expandClearance ? "pb-(--code-block-expand-clearance)" : undefined,
					)}
					style={surfaceStyle}>
					{/* `content-visibility: auto` is a measured dead end on BOTH axes:
					    its style containment breaks the shared gutter counter
					    (every number renders as 1), and per-row it still fails -
					    the paint containment clips the number cell, which is
					    deliberately pulled left OUT of the row's box (verified in
					    Chrome: forcing one row visible restored only that row's
					    number). Windowing here means rendering fewer rows, not
					    containing them. */}
					{/* presentation, so the listbox owns its options directly. */}
					<code data-slot="code-block-code" role={selectable ? "presentation" : undefined}>
						{lines.map((line) => (
							<CodeBlockLineRow
								key={line.number}
								line={line}
								selectable={selectable}
								selected={selectedSet.has(line.number - startLine + 1)}
								focusMode={focusMode}
								active={activeLine === line.number}
								caret={streaming ? line.number === lastLineNumber : false}
								labels={labels}
								actions={activeLine === line.number ? actions : null}
								actionsSide={actionsSide}
								domIdBase={contentId}
								startLine={startLine}
								onSelect={toggleDisplayed}
								foldable={foldable}
								foldRegion={foldStarts.get(line.number - startLine + 1)}
								folded={foldedSet.has(line.number - startLine + 1)}
								onToggleFold={onToggleFold}
							/>
						))}
					</code>
				</pre>
			</div>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Chrome                                   */
/* -------------------------------------------------------------------------- */
