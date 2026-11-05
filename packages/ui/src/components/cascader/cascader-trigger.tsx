"use client";

// The cascader's trigger and chips (enhancement 8.1: split from cascader.tsx).

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { isFunctionValue } from "@workspace/shared";
import { useCascaderActions, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import {
	applyCascadeSelection,
	collapseCascaderPath,
	findAmbiguousCascaderLabels,
	getCascaderCheckedValues,
	getCascaderPath,
} from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderCheckedStrategy } from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderNodeBase, CascaderPathSegment } from "@workspace/ui/components/cascader/cascader-types";
import { fieldStateVariants } from "@workspace/ui/lib/form/field-variants";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronDownIcon, XIcon } from "lucide-react";
import * as React from "react";

/**
 * The trigger surface. `default` is the kit's field look; `plain` keeps only the
 * icon sizing and the state treatment, for a trigger that renders through
 * another control (`render={<Button variant="outline" />}`), which it becomes
 * automatically when `render` is passed.
 */
export const cascaderTriggerVariants = cva("[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
	variants: {
		variant: {
			default:
				"group/cascader-trigger flex items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
			plain: "",
		},
		size: { sm: "", default: "", lg: "" },
		state: fieldStateVariants.state,
	},
	compoundVariants: [
		{ variant: "default", size: "sm", className: "h-8" },
		{ variant: "default", size: "default", className: "h-9" },
		{ variant: "default", size: "lg", className: "h-10" },
	],
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

export type CascaderTriggerVariant = "default" | "plain";

export interface CascaderTriggerProps extends ComboboxPrimitive.Trigger.Props {
	/** Hides the trailing chevron, for a trigger that supplies its own. */
	readonly showIcon?: boolean | undefined;
	readonly variant?: CascaderTriggerVariant | undefined;
}

export const TRIGGER_ICON = <ChevronDownIcon aria-hidden className="pointer-events-none size-4 shrink-0 text-muted-foreground" />;

/** The popup trigger. Its contents are the field's VALUE, so give it a name (`aria-label`, or a `<label htmlFor>` on its `id`). */
export const CascaderTrigger = React.forwardRef<HTMLButtonElement, CascaderTriggerProps>(function CascaderTrigger(
	{ className, children, showIcon = true, variant, render, disabled: disabledProp, ...props },
	ref,
): React.JSX.Element {
	const { invalid, disabled: rootDisabled, loading, size } = useCascaderActions();
	const disabled = disabledProp ?? rootDisabled;
	const state = resolveFieldState({ disabled, loading, ariaInvalid: invalid ? true : undefined });
	const resolvedVariant = variant ?? (render === undefined ? "default" : "plain");

	return (
		<ComboboxPrimitive.Trigger
			ref={ref}
			data-slot="cascader-trigger"
			render={render}
			disabled={disabled}
			aria-invalid={invalid ? true : undefined}
			aria-busy={loading ? true : undefined}
			data-invalid={invalid ? "" : undefined}
			className={cn(cascaderTriggerVariants({ variant: resolvedVariant, size, state }), className)}
			{...props}>
			{children}
			{showIcon ? TRIGGER_ICON : null}
		</ComboboxPrimitive.Trigger>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Chips                                   */
/* -------------------------------------------------------------------------- */

/** Ref for the chips container: they replace the trigger, so the popup is anchored to them. Hand it to `CascaderContent`'s `anchor`. */
export function useCascaderAnchor(): React.RefObject<HTMLDivElement | null> {
	return React.useRef<HTMLDivElement | null>(null);
}

export const cascaderChipsVariants = cva(
	"flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-data-[slot=cascader-chip]:px-1.5 dark:bg-input/30",
	{
		variants: {
			variant: { default: "" },
			size: { sm: "min-h-8", default: "min-h-9", lg: "min-h-10" },
			state: fieldStateVariants.state,
		},
		defaultVariants: { variant: "default", size: "default", state: "default" },
	},
);

export interface CascaderChipsProps extends Omit<ComboboxPrimitive.Chips.Props, "children"> {
	/** Shown in place of the chips when nothing is selected. */
	readonly placeholder?: React.ReactNode;
	/** How a `cascade` selection is condensed into chips. DISPLAY ONLY: the stored value stays the full closure. */
	readonly strategy?: CascaderCheckedStrategy | undefined;
	/** Replaces the chip list, receiving the resolved selection IN SELECTION ORDER (Base UI removes a chip by position). */
	readonly children?: React.ReactNode | ((nodes: readonly CascaderNodeBase[]) => React.ReactNode);
}

export function isChipsRenderer(children: CascaderChipsProps["children"]): children is (nodes: readonly CascaderNodeBase[]) => React.ReactNode {
	return isFunctionValue(children);
}

/**
 * The multi-select trigger surface: one removable chip per selection. The
 * popup anchors to the chips, every remove button is named, and labels that
 * collide across branches show their path.
 */
export const CascaderChips = React.forwardRef<HTMLDivElement, CascaderChipsProps>(function CascaderChips(
	{ className, children, placeholder, strategy = "all", ...props },
	ref,
): React.JSX.Element {
	const { labels, invalid, disabled, loading, size, resolveNode, index, isSelectable, setSelection } = useCascaderActions();
	const { selectedValues } = useCascaderState();
	const state = resolveFieldState({ disabled, loading, ariaInvalid: invalid ? true : undefined });

	// DERIVED display: the selection stays the full closure, the chips condense.
	const displayedValues = strategy === "all" ? selectedValues : getCascaderCheckedValues(index, selectedValues, strategy);
	const nodes = displayedValues.map(resolveNode);
	const ambiguous = findAmbiguousCascaderLabels(nodes);

	// Removal for a CONDENSED chip: Base UI's positional removal is wrong once the chips are fewer, so this removes the chip's closure.
	const removeClosure = React.useCallback(
		(node: CascaderNodeBase): void => {
			setSelection(applyCascadeSelection(index, selectedValues, node.value, false, isSelectable), "deselect");
		},
		[setSelection, index, selectedValues, isSelectable],
	);

	const content = isChipsRenderer(children) ? children(nodes) : children;

	return (
		<ComboboxPrimitive.Chips
			ref={ref}
			data-slot="cascader-chips"
			// An unnamed `role="toolbar"` announces as just "toolbar".
			aria-label={labels.chipsLabel}
			aria-invalid={invalid ? true : undefined}
			data-invalid={invalid ? "" : undefined}
			className={cn(cascaderChipsVariants({ size, state }), className)}
			{...props}>
			{content ??
				(nodes.length === 0 ? (
					<span data-slot="cascader-chips-placeholder" className="truncate text-muted-foreground">
						{placeholder}
					</span>
				) : (
					nodes.map((node: CascaderNodeBase): React.JSX.Element => (
						<CascaderChip key={node.value} node={node} showPath={ambiguous.has(node.value)} onRemove={strategy === "all" ? undefined : removeClosure} />
					))
				))}
		</ComboboxPrimitive.Chips>
	);
});

export interface CascaderChipProps extends Omit<ComboboxPrimitive.Chip.Props, "children"> {
	readonly node: CascaderNodeBase;
	/** Prefix the label with its ancestor trail. */
	readonly showPath?: boolean | undefined;
	/** Trail segments to show, the node itself included. */
	readonly maxSegments?: number | undefined;
	/** Hides the remove button, for a read-only chip. */
	readonly showRemove?: boolean | undefined;
	/** Replaces Base UI's positional removal for this chip (remove button and Backspace/Delete), given the chip's node. */
	readonly onRemove?: ((node: CascaderNodeBase) => void) | undefined;
	/** Replaces the chip's label. The remove button is still rendered. */
	readonly children?: React.ReactNode;
}

export type CascaderChipKeyEvent = Parameters<NonNullable<ComboboxPrimitive.Chip.Props["onKeyDown"]>>[0];
export type CascaderChipRemoveClickEvent = Parameters<NonNullable<ComboboxPrimitive.ChipRemove.Props["onClick"]>>[0];

/** Trail segments a chip's path keeps by default, itself included. */
export const CHIP_PATH_SEGMENTS = 2;

export const CHIP_REMOVE_ICON = <XIcon aria-hidden className="pointer-events-none size-3" />;

/** One chip. Removal goes through Base UI's `ChipRemove`, which reports the shortened selection to the root. */
export const CascaderChip = React.forwardRef<HTMLDivElement, CascaderChipProps>(function CascaderChip(
	{ className, node, showPath = false, maxSegments = CHIP_PATH_SEGMENTS, showRemove = true, onRemove, onKeyDown, children, ...props },
	ref,
): React.JSX.Element {
	const { labels, index } = useCascaderActions();

	const chain = showPath ? getCascaderPath(index, node.value) : [];
	const segments = collapseCascaderPath(chain, { maxSegments, collapse: "start" });
	const label =
		segments.length > 0
			? segments.map((segment: CascaderPathSegment): string => (segment.type === "node" ? segment.node.label : "…")).join(` ${labels.pathSeparator} `)
			: node.label;

	// Keyboard half of `onRemove`: Base UI's chip removes ITSELF by position on Backspace/Delete. The veto runs first.
	const handleKeyDown = React.useCallback(
		(event: CascaderChipKeyEvent): void => {
			onKeyDown?.(event);
			if (onRemove === undefined || (event.key !== "Backspace" && event.key !== "Delete")) {
				return;
			}
			event.preventBaseUIHandler();
			onRemove(node);
		},
		[onKeyDown, onRemove, node],
	);

	const handleRemoveClick = React.useCallback(
		(event: CascaderChipRemoveClickEvent): void => {
			if (onRemove === undefined) {
				return;
			}
			event.preventBaseUIHandler();
			onRemove(node);
		},
		[onRemove, node],
	);

	return (
		<ComboboxPrimitive.Chip
			ref={ref}
			data-slot="cascader-chip"
			onKeyDown={handleKeyDown}
			className={cn(
				"flex h-5.5 w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=cascader-chip-remove]:pe-0",
				className,
			)}
			{...props}>
			{children ?? <span className="truncate">{label}</span>}
			{showRemove ? (
				<ComboboxPrimitive.ChipRemove
					data-slot="cascader-chip-remove"
					// Named after what the chip DISPLAYS, or two disambiguated chips both announce the same name.
					aria-label={labels.removeChip(label)}
					onClick={handleRemoveClick}
					className="-ms-1 rounded-sm opacity-50 hover:opacity-100">
					{CHIP_REMOVE_ICON}
				</ComboboxPrimitive.ChipRemove>
			) : null}
		</ComboboxPrimitive.Chip>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */
