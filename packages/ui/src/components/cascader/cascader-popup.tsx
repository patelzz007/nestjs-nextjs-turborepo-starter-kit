"use client";

// The cascader's popup (enhancement 8.1: split from cascader.tsx): content, panel, list, and its empty and status states.

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useCascaderLoadState } from "@workspace/ui/components/cascader/cascader-async";
import { useCascaderActions, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import { toCascaderCssLength } from "@workspace/ui/components/cascader/cascader-columns";
import {
	CASCADER_LIST_HEIGHT_CLASS,
	CASCADER_LIST_PAD_CLASS,
	CASCADER_ROOT_KEY,
	CASCADER_ROWS_CLASS,
	CASCADER_SCROLL_CLASS,
	focusCascaderHome,
	getCascaderTabTarget,
} from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderLoadState } from "@workspace/ui/components/cascader/cascader-types";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface CascaderContentProps
	extends
		ComboboxPrimitive.Popup.Props,
		Pick<
			ComboboxPrimitive.Positioner.Props,
			"side" | "align" | "sideOffset" | "alignOffset" | "anchor" | "collisionBoundary" | "collisionPadding" | "sticky" | "positionMethod"
		>,
		Pick<ComboboxPrimitive.Portal.Props, "container"> {}

export const CONTENT_SURFACE_CLASS =
	"group/combobox-content relative flex max-h-(--available-height) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

/** Gap between the trigger and the popup, in pixels. */
export const CONTENT_SIDE_OFFSET_PX = 6;

/**
 * Portal + Positioner + floating panel. Unlike the kit's `ComboboxContent` it
 * does NOT clamp the popup to the anchor width: a cascader panel is routinely wider.
 */
export const CascaderContent = React.forwardRef<HTMLDivElement, CascaderContentProps>(function CascaderContent(
	{
		className,
		side = "bottom",
		sideOffset = CONTENT_SIDE_OFFSET_PX,
		align = "start",
		alignOffset = 0,
		anchor,
		collisionBoundary,
		collisionPadding,
		sticky,
		positionMethod,
		container,
		...props
	},
	ref,
): React.JSX.Element {
	const { labels } = useCascaderActions();
	const popupRef = React.useRef<HTMLDivElement | null>(null);
	const setPopup = React.useCallback(
		(element: HTMLDivElement | null): void => {
			popupRef.current = element;
			assignRef(ref, element);
		},
		[ref],
	);

	/** Focus goes to the search field, where the level keys and `aria-activedescendant` live. Touch is handed back to Base UI. */
	const initialFocus = React.useCallback((openType: string): HTMLElement | boolean => {
		const popup = popupRef.current;
		if (popup === null) {
			return true;
		}
		if (openType === "touch") {
			return popup;
		}
		return popup.querySelector<HTMLElement>('[data-slot="cascader-input"]') ?? true;
	}, []);

	return (
		<ComboboxPrimitive.Portal container={container}>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				collisionBoundary={collisionBoundary}
				collisionPadding={collisionPadding}
				sticky={sticky}
				positionMethod={positionMethod}
				className="isolate z-popover">
				<ComboboxPrimitive.Popup
					ref={setPopup}
					data-slot="cascader-content"
					// The input inside makes this a `role="dialog"`, unnamed by default.
					aria-label={labels.panelLabel}
					initialFocus={initialFocus}
					className={cn(CONTENT_SURFACE_CLASS, className)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

export type CascaderPanelProps = useRender.ComponentProps<"div">;

/**
 * The nav + list(s) + footer container: inside `CascaderContent` for the popup
 * case, alone for the embedded one. Owns the panel's TAB ORDER: the scroll area
 * makes itself a tab stop whenever the level overflows, which would strand the footer.
 */
export const CascaderPanel = React.forwardRef<HTMLDivElement, CascaderPanelProps>(function CascaderPanel({ className, render, ...props }, ref): React.ReactElement {
	const { mode } = useCascaderActions();

	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
		if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const panel = event.currentTarget;
		const { target } = event;
		if (!(target instanceof Element) || !panel.contains(target)) {
			return;
		}
		const next = getCascaderTabTarget(panel, target, event.shiftKey);
		// Off either end: left to the browser, since focus is never trapped.
		if (next === null) {
			return;
		}
		event.preventDefault();
		next.focus();
	}, []);

	// In `defaultProps`: `mergeProps` chains right to left, so a consumer's handler runs FIRST and can drop this one.
	const defaultProps = { "data-slot": "cascader-panel", "data-mode": mode, onKeyDown: handleKeyDown, className: cn("flex max-h-full min-h-0 w-full flex-col", className) };

	return useRender({ defaultTagName: "div", render, ref, props: mergeProps<"div">(defaultProps, props) });
});

/* -------------------------------------------------------------------------- */
/*                                    List                                    */
/* -------------------------------------------------------------------------- */

export interface CascaderListProps extends Omit<ComboboxPrimitive.List.Props, "style"> {
	/** Applied to the OUTER shell, which owns the height. */
	readonly style?: React.CSSProperties | undefined;
	/** Caps this level's height; the panel still shrinks to fit. Default 24rem. A number is pixels. */
	readonly maxHeight?: number | string | undefined;
}

export type CascaderListShellStyle = React.CSSProperties & Partial<Readonly<Record<"--cascader-max-height", string>>>;

/**
 * Scroll container for one level: viewport-bounded popup scroll, the height
 * `min()` of `--available-height` and `maxHeight`, so neither can be ignored.
 */
export const CascaderList = React.forwardRef<HTMLDivElement, CascaderListProps>(function CascaderList(
	{ className, style, maxHeight: maxHeightProp, ...props },
	ref,
): React.JSX.Element {
	const { maxHeight, mode, labels, baseId, virtualized, searchScope } = useCascaderActions();
	const { currentParent, deepResults } = useCascaderState();
	const resolved = maxHeightProp ?? maxHeight;
	// Global hits come from the whole tree, so the parent would understate them.
	const listName = searchScope === "global" && deepResults !== null ? labels.rootLevel : (currentParent?.label ?? labels.rootLevel);

	const shellStyle = React.useMemo(
		(): CascaderListShellStyle | undefined => (resolved === undefined ? style : { ...style, "--cascader-max-height": toCascaderCssLength(resolved) }),
		[resolved, style],
	);

	return (
		<div data-slot="cascader-list-shell" style={shellStyle} className={cn("relative flex max-h-full min-h-0", CASCADER_LIST_PAD_CLASS)}>
			<div data-slot="cascader-list-bounds" className={cn("flex w-full min-w-0 flex-col overscroll-contain", CASCADER_LIST_HEIGHT_CLASS)}>
				<ScrollArea className={CASCADER_SCROLL_CLASS}>
					<ComboboxPrimitive.List
						ref={ref}
						data-slot="cascader-list"
						// Base UI names the list nothing. The level's parent is the name; the root borrows one.
						aria-label={listName}
						// Replaces Base UI's floating id, so `aria-controls` gets a predictable target.
						id={`${baseId}-column-0`}
						role={mode === "tree" ? "tree" : "listbox"}
						data-virtualized={virtualized ? "" : undefined}
						className={cn(CASCADER_ROWS_CLASS, virtualized ? "relative" : undefined, className)}
						{...props}
					/>
				</ScrollArea>
			</div>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                              Empty / Loading                               */
/* -------------------------------------------------------------------------- */

export type CascaderEmptyProps = ComboboxPrimitive.Empty.Props;

export function resolveEmptyState(state: CascaderLoadState | null): "error" | "loading" | "empty" {
	if (state?.error === true) {
		return "error";
	}
	return state?.loading === true ? "loading" : "empty";
}

/**
 * The empty, loading and error surface, in ONE element that never unmounts:
 * `Combobox.Empty` renders whenever nothing is listed, as true of a fetching
 * level as of an empty one, so the CHILDREN swap.
 */
export const CascaderEmpty = React.forwardRef<HTMLDivElement, CascaderEmptyProps>(function CascaderEmpty({ className, children, ...props }, ref): React.JSX.Element {
	const { labels, retryLevel, retrySearch } = useCascaderActions();
	const { query, path, searchState } = useCascaderState();
	// The level whose emptiness is on screen; tree always shows the root.
	const levelKey = path.at(-1) ?? CASCADER_ROOT_KEY;
	const loadState = useCascaderLoadState(levelKey);
	const searching = query.trim() !== "";
	const state = searching ? (searchState ?? loadState) : loadState;
	const emptyState = resolveEmptyState(state);

	const handleRetry = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			focusCascaderHome(event.currentTarget);
			// With a query set the error shown is the SEARCH's, so that is what to ask again.
			if (searching && searchState?.error === true) {
				retrySearch();
			} else {
				retryLevel(levelKey);
			}
		},
		[searching, searchState, retrySearch, retryLevel, levelKey],
	);

	let body: React.ReactNode = children ?? labels.empty;
	if (emptyState === "error") {
		body = (
			<span data-slot="cascader-error" className="flex flex-col items-center gap-1.5">
				<span>{labels.error}</span>
				{/* A real button: this lives OUTSIDE the listbox. */}
				<button
					type="button"
					data-slot="cascader-retry"
					onClick={handleRetry}
					className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50">
					{labels.retry}
				</button>
			</span>
		);
	} else if (emptyState === "loading") {
		body = (
			<span data-slot="cascader-loading" className="flex w-full items-center justify-center">
				{labels.loading}
			</span>
		);
	}

	return (
		<ComboboxPrimitive.Empty
			ref={ref}
			data-slot="cascader-empty"
			data-state={emptyState}
			className={cn("hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex", className)}
			// Explicit `undefined` DELETES Base UI's own live region: `CascaderStatus` is the single one.
			role={undefined}
			aria-live={undefined}
			aria-atomic={undefined}
			{...props}>
			{body}
		</ComboboxPrimitive.Empty>
	);
});

export type CascaderStatusProps = ComboboxPrimitive.Status.Props;

/** Polite live region for the current level and result count, which drill-down otherwise hides in a visual breadcrumb. */
export const CascaderStatus = React.forwardRef<HTMLDivElement, CascaderStatusProps>(function CascaderStatus({ className, children, ...props }, ref): React.JSX.Element {
	const { announcement } = useCascaderState();
	return (
		<ComboboxPrimitive.Status ref={ref} data-slot="cascader-status" className={cn("sr-only", className)} {...props}>
			{children ?? announcement}
		</ComboboxPrimitive.Status>
	);
});
