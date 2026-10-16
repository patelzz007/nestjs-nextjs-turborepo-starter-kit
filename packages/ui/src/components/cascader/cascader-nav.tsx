"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useDirection } from "@base-ui/react/direction-provider";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useCascaderActions, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import { resolveCascaderSearchLabel } from "@workspace/ui/components/cascader/cascader-i18n";
import { collapseCascaderPath, getCascaderFooterStops, getCascaderPath, isCascaderRtl } from "@workspace/ui/components/cascader/cascader-lib";
import type {
	CascaderCollapse,
	CascaderDirection,
	CascaderFlatNode,
	CascaderNodeBase,
	CascaderPathSegment,
	CascaderValueDisplay,
} from "@workspace/ui/components/cascader/cascader-types";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

/* -------------------------------------------------------------------------- */
/*                                  Separator                                 */
/* -------------------------------------------------------------------------- */

const PATH_CHEVRON = <ChevronRightIcon aria-hidden className="size-3 shrink-0 opacity-50 rtl:-scale-x-100" />;
const BACK_ICON = <ChevronLeftIcon aria-hidden className="size-4 rtl:-scale-x-100" />;

/** A real button never submits the form a cascader sits in. */
const BUTTON_PROPS: Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> = { type: "button" };

/** The one ellipsis a collapsed path can hold, so its key is fixed. */
const ELLIPSIS_KEY = "ellipsis";

function segmentKey(segment: CascaderPathSegment): string {
	return segment.type === "node" ? segment.node.value : ELLIPSIS_KEY;
}

function joinLabels(nodes: readonly CascaderNodeBase[], separator: string): string {
	return nodes.map((node: CascaderNodeBase): string => node.label).join(` ${separator} `);
}

/* -------------------------------------------------------------------------- */
/*                                     Nav                                    */
/* -------------------------------------------------------------------------- */

export type CascaderNavProps = useRender.ComponentProps<"div">;

/**
 * Header: back control, search input, and the separator under them. The
 * breadcrumb belongs with the list below: it describes the rows, not the field.
 */
const CascaderNav = React.forwardRef<HTMLDivElement, CascaderNavProps>(function CascaderNav({ className, render, ...props }, ref): React.ReactElement {
	const defaultProps = { "data-slot": "cascader-nav", className: cn("flex shrink-0 flex-col gap-1 border-b border-border/60 px-1.5 py-1", className) };
	return useRender({ defaultTagName: "div", render, ref, props: mergeProps<"div">(defaultProps, props) });
});

/* -------------------------------------------------------------------------- */
/*                                    Back                                    */
/* -------------------------------------------------------------------------- */

export interface CascaderBackProps extends Omit<useRender.ComponentProps<"button">, "children"> {
	readonly children?: React.ReactNode;
}

/** Pops one level. Renders nothing at the root or outside drill mode, so no dead header space. */
const CascaderBack = React.forwardRef<HTMLButtonElement, CascaderBackProps>(function CascaderBack({ className, children, render, ...props }, ref): React.ReactElement | null {
	const { popLevel, labels, mode } = useCascaderActions();
	const { path } = useCascaderState();

	// Checked after `useRender`, never before it: an early return would change the hook count between levels.
	const hidden = mode !== "drill" || path.length === 0;

	const defaultProps = {
		"data-slot": "cascader-back",
		...BUTTON_PROPS,
		"aria-label": labels.back,
		onClick: popLevel,
		className: cn(
			"flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
			className,
		),
		children: children ?? BACK_ICON,
	};

	const element = useRender({ defaultTagName: "button", render, ref, props: mergeProps<"button">(defaultProps, props) });

	return hidden ? null : element;
});

/* -------------------------------------------------------------------------- */
/*                                 Breadcrumb                                 */
/* -------------------------------------------------------------------------- */

export interface CascaderBreadcrumbProps extends Omit<useRender.ComponentProps<"nav">, "children"> {
	/** Maximum visible node segments before the middle collapses. */
	readonly maxSegments?: number | undefined;
	readonly collapse?: CascaderCollapse | undefined;
	/** Clicking a segment navigates back to that level. Defaults to true. */
	readonly interactive?: boolean | undefined;
}

interface CascaderBreadcrumbLinkProps {
	readonly node: CascaderNodeBase;
	/** The depth `goToDepth` returns to: the crumb's position in the path plus one. */
	readonly depth: number;
}

/** One crumb that goes somewhere. `goToDepth`, not a bare `setPath`: it reports `reason: "breadcrumb"`, clears the query and drops any pending navigation. */
function CascaderBreadcrumbLink({ node, depth }: CascaderBreadcrumbLinkProps): React.JSX.Element {
	const { goToDepth } = useCascaderActions();
	const handleClick = React.useCallback((): void => {
		goToDepth(depth);
	}, [goToDepth, depth]);

	return (
		<button
			type="button"
			data-slot="cascader-breadcrumb-item"
			onClick={handleClick}
			className="max-w-32 truncate rounded-sm outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
			{node.label}
		</button>
	);
}

/**
 * Compact trail of the current level AND its ancestors, collapsed by the same
 * helper as `CascaderValue` so panel and trigger cannot disagree. The current
 * level IS the last crumb, marked `aria-current="page"`.
 */
const CascaderBreadcrumb = React.forwardRef<HTMLElement, CascaderBreadcrumbProps>(function CascaderBreadcrumb(
	{ className, maxSegments, collapse = "middle", interactive = true, render, ...props },
	ref,
): React.ReactElement | null {
	const { mode, labels } = useCascaderActions();
	const { path, index } = useCascaderState();

	// The WHOLE path, current level included; unresolvable entries drop out.
	const nodes = path.map((value: string): CascaderNodeBase | undefined => index.byValue.get(value)).filter((node): node is CascaderNodeBase => node !== undefined);
	const segments = collapseCascaderPath(nodes, { maxSegments, collapse });
	const currentValue = nodes.at(-1)?.value ?? null;

	// See `CascaderBack`: the hide check must not short-circuit past `useRender`.
	const hidden = mode !== "drill" || nodes.length === 0;

	const defaultProps = {
		"data-slot": "cascader-breadcrumb",
		"aria-label": labels.breadcrumbLabel,
		className: cn("flex min-w-0 shrink-0 items-center gap-0.5 px-3 pt-1.5 pb-0.5 text-xs text-muted-foreground", className),
		children: segments.map((segment: CascaderPathSegment, position: number): React.JSX.Element => (
			<React.Fragment key={segmentKey(segment)}>
				{position > 0 ? PATH_CHEVRON : null}
				{segment.type === "ellipsis" ? (
					<span data-slot="cascader-breadcrumb-ellipsis" title={joinLabels(segment.hidden, labels.pathSeparator)} className="shrink-0">
						&hellip;
					</span>
				) : null}
				{segment.type === "node" && interactive && segment.node.value !== currentValue ? (
					<CascaderBreadcrumbLink node={segment.node} depth={path.indexOf(segment.node.value) + 1} />
				) : null}
				{segment.type === "node" && (!interactive || segment.node.value === currentValue) ? (
					<span
						data-slot="cascader-breadcrumb-item"
						aria-current={segment.node.value === currentValue ? "page" : undefined}
						className={cn("max-w-32 truncate", segment.node.value === currentValue ? "font-medium text-foreground" : undefined)}>
						{segment.node.label}
					</span>
				) : null}
			</React.Fragment>
		)),
	};

	const element = useRender({ defaultTagName: "nav", render, ref, props: mergeProps<"nav">(defaultProps, props) });

	return hidden ? null : element;
});

/* -------------------------------------------------------------------------- */
/*                                    Input                                   */
/* -------------------------------------------------------------------------- */

/** The search field row's height, by density, and the field's own state. */
export const cascaderInputVariants = cva(
	"h-full w-full min-w-0 flex-1 bg-transparent px-1.5 outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
	{
		variants: {
			variant: { default: "" },
			size: { sm: "text-xs", default: "text-sm", lg: "text-sm" },
			state: { default: "", loading: "cursor-wait", disabled: "cursor-not-allowed opacity-50", error: "text-destructive placeholder:text-destructive/70" },
		},
		defaultVariants: { variant: "default", size: "default", state: "default" },
	},
);

const cascaderInputRowVariants = cva("flex shrink-0 items-center gap-1", {
	variants: { size: { sm: "h-7", default: "h-8", lg: "h-9" } },
	defaultVariants: { size: "default" },
});

export interface CascaderInputProps extends ComboboxPrimitive.Input.Props {
	/** Renders the back control inline, before the field. Defaults to true. */
	readonly showBack?: boolean | undefined;
}

/** Base UI hands its input handlers an event carrying the veto hook. */
type CascaderInputKeyEvent = Parameters<NonNullable<ComboboxPrimitive.Input.Props["onKeyDown"]>>[0];

type CascaderLevelKey = "ArrowLeft" | "ArrowRight";

/** The highlighted row's position in the tree rows, or `-1`. */
function highlightedTreeRow(treeRows: readonly CascaderFlatNode[], highlighted: CascaderNodeBase | null): number {
	if (highlighted === null) {
		return -1;
	}
	return treeRows.findIndex((row: CascaderFlatNode): boolean => row.node.value === highlighted.value);
}

/**
 * Search field. MUST render inside the positioner: only there does Base UI skip
 * the refill from the committed selection that would fight every level swap.
 * Owns the level keys: forward/back (mirrored in RTL) drill in and out,
 * Backspace on an empty query goes back, ArrowDown past the last row hands
 * focus to the footer.
 */
const CascaderInput = React.forwardRef<HTMLInputElement, CascaderInputProps>(function CascaderInput(
	{ className, showBack = true, placeholder, onKeyDown, disabled, "aria-describedby": ariaDescribedBy, ...props },
	ref,
): React.JSX.Element {
	const { labels, popLevel, mode, size, getHighlighted, isBranch, isDisabled, navigate, index, toggleExpanded, inline, invalid, baseId, searchScope } = useCascaderActions();
	const direction = useDirection();
	const { currentParent, query, path, expanded, renderedItems, treeRows } = useCascaderState();

	// Root wording under a global search: naming the level on screen would promise a narrower search than the one that runs.
	const resolvedPlaceholder = placeholder ?? resolveCascaderSearchLabel(labels, searchScope === "global" ? undefined : currentParent?.label);
	const backVisible = showBack && mode === "drill" && path.length > 0;
	const hintId = `${baseId}-hint`;
	// Base UI names no list while inline; columns mode moves the real listbox to the deepest panel.
	const listId = `${baseId}-column-${String(mode === "columns" ? path.length : 0)}`;
	const describedBy = ariaDescribedBy === undefined ? hintId : `${ariaDescribedBy} ${hintId}`;
	const fieldState = resolveFieldState({ disabled, ariaInvalid: invalid ? true : undefined });

	// The direction the HINT is worded for, read off the mounted DOM so a `dir` attribute without a `DirectionProvider` still counts.
	const [hintDir, setHintDir] = React.useState<CascaderDirection>("ltr");
	const hintRef = React.useCallback(
		(hint: HTMLSpanElement | null): void => {
			if (hint !== null) {
				setHintDir(isCascaderRtl(hint, direction) ? "rtl" : "ltr");
			}
		},
		[direction],
	);

	const setInputRef = React.useCallback(
		(element: HTMLInputElement | null): void => {
			assignRef(ref, element);
		},
		[ref],
	);

	/**
	 * Moves the highlight to `targetIndex` in `treeRows`. Base UI has no
	 * imperative setter, so the move is arrow presses, sound only because its
	 * list navigation fires `onItemHighlighted` SYNCHRONOUSLY per keydown.
	 */
	const moveHighlightTo = React.useCallback(
		(field: HTMLInputElement, targetIndex: number): void => {
			let current = highlightedTreeRow(treeRows, getHighlighted());
			let remaining = treeRows.length;
			while (remaining > 0) {
				remaining -= 1;
				if (current === -1 || current === targetIndex) {
					return;
				}
				const key = current > targetIndex ? "ArrowUp" : "ArrowDown";
				field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
				const next = highlightedTreeRow(treeRows, getHighlighted());
				const progressed = key === "ArrowUp" ? next < current && next >= targetIndex : next > current && next <= targetIndex;
				if (next === -1 || !progressed) {
					return;
				}
				current = next;
			}
		},
		[treeRows, getHighlighted],
	);

	/** The tree pattern's two level keys; Base UI's list navigation is vertical-only. RTL swaps them. */
	const handleTreeKeyDown = React.useCallback(
		(event: CascaderInputKeyEvent, field: HTMLInputElement, caretAtStart: boolean, caretAtEnd: boolean, forwardKey: CascaderLevelKey, backKey: CascaderLevelKey): void => {
			const forward = event.key === forwardKey;
			if (!forward && event.key !== backKey) {
				return;
			}
			if (forward ? !caretAtEnd : !caretAtStart) {
				return;
			}
			const rowIndex = highlightedTreeRow(treeRows, getHighlighted());
			const row = treeRows.at(rowIndex);
			if (rowIndex < 0 || row === undefined) {
				return;
			}

			if (forward) {
				if (!row.branch) {
					return;
				}
				event.preventDefault();
				if (!row.expanded) {
					// `navigate`, not `toggleExpanded`: it waits for an unloaded branch's children.
					navigate(row.node);
					return;
				}
				// Children follow their parent in the flattened rows; the depth check covers an empty branch.
				const child = treeRows.at(rowIndex + 1);
				if (child?.depth === row.depth + 1) {
					moveHighlightTo(field, rowIndex + 1);
				}
				return;
			}

			// A query holds every hit's ancestors open without adding them to `expanded`: such a row moves to its parent instead.
			const heldByQuery = isDisabled(row.node) && !expanded.has(row.node.value);
			if (row.branch && row.expanded && !heldByQuery) {
				event.preventDefault();
				toggleExpanded(row.node.value);
				return;
			}

			const parentValue = index.parentOf.get(row.node.value) ?? null;
			if (parentValue === null) {
				return;
			}
			const parentIndex = treeRows.findIndex((entry: CascaderFlatNode): boolean => entry.node.value === parentValue);
			if (parentIndex < 0) {
				return;
			}
			event.preventDefault();
			moveHighlightTo(field, parentIndex);
		},
		[treeRows, getHighlighted, navigate, moveHighlightTo, isDisabled, expanded, toggleExpanded, index],
	);

	const handleKeyDown = React.useCallback(
		(event: CascaderInputKeyEvent): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented) {
				return;
			}

			const field = event.currentTarget;
			const caretAtStart = field.selectionStart === 0 && field.selectionEnd === 0;
			const caretAtEnd = field.selectionStart === query.length && field.selectionEnd === query.length;

			// ArrowDown at the END of the list hands real focus to the pinned footer. An EMPTY list hands off at once.
			if (event.key === "ArrowDown" && !event.altKey) {
				const lastValue = mode === "tree" ? treeRows.at(-1)?.node.value : renderedItems.at(-1)?.value;
				const rowCount = mode === "tree" ? treeRows.length : renderedItems.length;
				const highlighted = getHighlighted();
				const atEnd = rowCount === 0 || highlighted?.value === lastValue;
				const panel = atEnd ? field.closest<HTMLElement>('[data-slot="cascader-panel"]') : null;
				const [stop] = panel === null ? [] : getCascaderFooterStops(panel);
				if (stop !== undefined) {
					event.preventDefault();
					stop.focus();
					return;
				}
			}

			// The level keys are LOGICAL, not physical: in RTL, ArrowLeft opens a branch and ArrowRight goes back.
			const rtl = isCascaderRtl(field, direction);
			const forwardKey: CascaderLevelKey = rtl ? "ArrowLeft" : "ArrowRight";
			const backKey: CascaderLevelKey = rtl ? "ArrowRight" : "ArrowLeft";

			if (mode === "tree") {
				handleTreeKeyDown(event, field, caretAtStart, caretAtEnd, forwardKey, backKey);
				return;
			}

			if (event.key === forwardKey && caretAtEnd) {
				const highlighted = getHighlighted();
				if (highlighted !== null && isBranch(highlighted)) {
					event.preventDefault();
					navigate(highlighted);
					return;
				}
			}

			// Backspace on an empty query pops a level too, so the keyboard way out of a level is symmetric with typing into it.
			if (((event.key === backKey && caretAtStart) || (event.key === "Backspace" && query.length === 0)) && path.length > 0) {
				event.preventDefault();
				popLevel();
			}
		},
		[onKeyDown, query, mode, treeRows, renderedItems, getHighlighted, direction, handleTreeKeyDown, isBranch, navigate, path.length, popLevel],
	);

	return (
		<div data-slot="cascader-input-row" className={cascaderInputRowVariants({ size })}>
			{showBack ? <CascaderBack /> : null}
			<ComboboxPrimitive.Input
				ref={setInputRef}
				data-slot="cascader-input"
				placeholder={resolvedPlaceholder}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				// Nothing on screen says the level keys exist.
				aria-describedby={describedBy}
				aria-haspopup={mode === "tree" ? "tree" : undefined}
				// Base UI omits BOTH `aria-expanded` and `aria-controls` while inline, and an embedded panel is permanently expanded.
				aria-expanded={inline ? true : undefined}
				aria-controls={inline ? listId : undefined}
				// No trigger to carry the invalid state in the `inline` case.
				aria-invalid={invalid ? true : undefined}
				data-invalid={invalid ? "" : undefined}
				className={cn(cascaderInputVariants({ size, state: fieldState }), backVisible ? "ps-0" : undefined, className)}
				{...props}
			/>
			<span id={hintId} ref={hintRef} className="sr-only">
				{labels.keyboardHint(mode, hintDir)}
			</span>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Value                                   */
/* -------------------------------------------------------------------------- */

export interface CascaderValueProps extends Omit<useRender.ComponentProps<"span">, "children"> {
	/** `path` shows the full trail, `leaf` only the node, `count` only a total. */
	readonly display?: CascaderValueDisplay | undefined;
	readonly maxSegments?: number | undefined;
	readonly collapse?: CascaderCollapse | undefined;
	readonly separator?: React.ReactNode;
	/** Renders the selected node's icon before the trail. */
	readonly showIcon?: boolean | undefined;
	readonly placeholder?: React.ReactNode;
	/** Replaces the whole rendering. Receives the resolved selection and path. */
	readonly children?: ((selected: readonly CascaderNodeBase[], path: readonly CascaderNodeBase[]) => React.ReactNode) | undefined;
}

/**
 * Trigger display. Defaults to the collapsed selection path rather than a bare
 * leaf label, which in a nested picker is frequently ambiguous.
 */
const CascaderValue = React.forwardRef<HTMLSpanElement, CascaderValueProps>(function CascaderValue(
	{ className, display = "path", maxSegments, collapse = "middle", separator, showIcon = true, placeholder, children, render, ...props },
	ref,
): React.ReactElement {
	const { labels, multiple, resolveNode } = useCascaderActions();
	const { index, selectedValues } = useCascaderState();

	// `resolveNode`, not `index.byValue`: a selection missing from `items` must still render a label, not an empty trigger.
	const selected = selectedValues.map(resolveNode);
	const [onlyValue] = selectedValues;
	const resolvedPath = selectedValues.length === 1 ? getCascaderPath(index, onlyValue) : [];
	// No ancestor chain: fall back to the node so `display="path"` shows a leaf.
	const path = resolvedPath.length > 0 ? resolvedPath : selected.length === 1 ? selected : [];

	let content: React.ReactNode;
	if (children !== undefined) {
		content = children(selected, path);
	} else if (selectedValues.length === 0) {
		content = <span className="truncate text-muted-foreground">{placeholder}</span>;
	} else if (display === "count" || (multiple && selectedValues.length > 1)) {
		content = labels.selectedCount(selectedValues.length);
	} else {
		const leaf = path.at(-1) ?? selected.at(0);
		const segments: CascaderPathSegment[] = display === "leaf" && leaf !== undefined ? [{ type: "node", node: leaf }] : collapseCascaderPath(path, { maxSegments, collapse });
		content = (
			<>
				{showIcon && leaf?.icon !== undefined ? (
					<span data-slot="cascader-value-icon" className="flex shrink-0 items-center text-muted-foreground">
						{leaf.icon}
					</span>
				) : null}
				{segments.map((segment: CascaderPathSegment, position: number): React.JSX.Element => (
					<React.Fragment key={segmentKey(segment)}>
						{position > 0 ? (separator ?? PATH_CHEVRON) : null}
						{segment.type === "ellipsis" ? (
							<span data-slot="cascader-value-ellipsis" title={joinLabels(segment.hidden, labels.pathSeparator)} className="shrink-0 text-muted-foreground">
								&hellip;
							</span>
						) : (
							<span className={cn("truncate", position < segments.length - 1 ? "text-muted-foreground" : undefined)}>{segment.node.label}</span>
						)}
					</React.Fragment>
				))}
			</>
		);
	}

	const defaultProps = { "data-slot": "cascader-value", className: cn("flex min-w-0 items-center gap-1 truncate", className), children: content };

	return useRender({ defaultTagName: "span", render, ref, props: mergeProps<"span">(defaultProps, props) });
});

export { CascaderBack, CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue };
