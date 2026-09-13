"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Button } from "@workspace/ui/components/form/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/form/input-group";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { comboboxInputGroupVariants, resolveCollectionItemActiveClasses, resolveCollectionItemDensityClasses } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useMemo } from "react";

import { comboboxListMaxHeightStyle, extractStringChild, useComboboxContext } from "./combobox-context";

// ── Value ───────────────────────────────────────────────────────────────────

export interface ComboboxValueProps {
	/** Custom renderer for the selected value, e.g. avatars/badges (feature 7). */
	readonly formatValue?: (value: string) => React.ReactNode;
	/** The placeholder shown when nothing is selected (base-ui passthrough). */
	readonly placeholder?: React.ReactNode;
}

/**
 * Renders the currently selected value's label. base-ui's `Value` part renders
 * no DOM element of its own (it returns the label text), so there is nothing to
 * forward a ref to — the smart component reads it from the root context.
 */
export function ComboboxValue({ children, formatValue, placeholder }: ComboboxValueProps & { readonly children?: React.ReactNode }): React.JSX.Element {
	return (
		<ComboboxPrimitive.Value data-slot="combobox-value" placeholder={placeholder}>
			{formatValue !== undefined ? (value: string): React.ReactNode => formatValue(value) : children}
		</ComboboxPrimitive.Value>
	);
}

// ── Trigger ─────────────────────────────────────────────────────────────────

export interface ComboboxTriggerProps extends ComboboxPrimitive.Trigger.Props {
	/** Accessible name for the icon-only chevron button (improvement 3). */
	readonly ariaLabel?: string;
}

export const ComboboxTrigger = React.forwardRef<HTMLButtonElement, ComboboxTriggerProps>(function ComboboxTrigger(
	{ className, children, ariaLabel = "Open options", ...props },
	ref,
): React.JSX.Element {
	return (
		<ComboboxPrimitive.Trigger ref={ref} data-slot="combobox-trigger" aria-label={ariaLabel} className={cn("[&_svg:not([class*='size-'])]:size-4", className)} {...props}>
			{children}
			<ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
		</ComboboxPrimitive.Trigger>
	);
});

// ── Clear ───────────────────────────────────────────────────────────────────

export interface ComboboxClearProps extends ComboboxPrimitive.Clear.Props {
	/** Accessible name for the icon-only clear button (improvement 18). */
	readonly ariaLabel?: string;
}

export const ComboboxClear = React.forwardRef<HTMLButtonElement, ComboboxClearProps>(function ComboboxClear(
	{ className, ariaLabel = "Clear selection", ...props },
	ref,
): React.JSX.Element {
	return (
		<ComboboxPrimitive.Clear
			ref={ref}
			data-slot="combobox-clear"
			aria-label={ariaLabel}
			render={<InputGroupButton variant="ghost" size="icon-xs" />}
			className={cn(className)}
			{...props}>
			<XIcon className="pointer-events-none" />
		</ComboboxPrimitive.Clear>
	);
});

// ── Input ───────────────────────────────────────────────────────────────────

export interface ComboboxInputProps extends ComboboxPrimitive.Input.Props {
	/** Render the chevron toggle inside the input group. */
	readonly showTrigger?: boolean;
	/** Render the clear (x) button inside the input group. */
	readonly showClear?: boolean;
	/** Disable the whole input group and mirror it with aria-disabled (improvement 16). */
	readonly disabled?: boolean;
	/** Placeholder shown when no value is selected. */
	readonly placeholder?: string;
	/** Validation override — falls back to Root `invalid`. */
	readonly invalid?: boolean;
}

export const ComboboxInput = React.forwardRef<HTMLInputElement, ComboboxInputProps>(function ComboboxInput(
	{ className, children, disabled = false, invalid: invalidProp, showTrigger = true, showClear = false, placeholder, ...props },
	ref,
): React.JSX.Element {
	const context = useComboboxContext();
	const { size, loading, invalid: contextInvalid } = context;
	const invalid = invalidProp ?? contextInvalid;
	const fieldState = resolveFieldState({ disabled, loading, ariaInvalid: invalid ? true : undefined });

	const setRefs = useCallback(
		(node: HTMLInputElement | null): void => {
			context.registerInput(node);
			if (typeof ref === "function") {
				ref(node);
			} else if (ref !== null) {
				ref.current = node;
			}
		},
		[context, ref],
	);

	return (
		<InputGroup className={cn(comboboxInputGroupVariants({ size, state: fieldState }), className)}>
			<ComboboxPrimitive.Input
				ref={setRefs}
				render={<InputGroupInput disabled={disabled} aria-disabled={disabled || undefined} aria-invalid={invalid ? true : undefined} placeholder={placeholder} />}
				{...props}
			/>
			<InputGroupAddon align="inline-end">
				{showTrigger ? (
					<InputGroupButton
						size="icon-xs"
						variant="ghost"
						render={<ComboboxTrigger />}
						data-slot="input-group-button"
						className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent max-sm:size-8"
						disabled={disabled}
					/>
				) : null}
				{showClear ? <ComboboxClear disabled={disabled} /> : null}
			</InputGroupAddon>
			{children}
		</InputGroup>
	);
});

// ── Content ─────────────────────────────────────────────────────────────────

export interface ComboboxContentProps
	extends ComboboxPrimitive.Popup.Props, Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "anchor"> {}

export const ComboboxContent = React.forwardRef<HTMLDivElement, ComboboxContentProps>(function ComboboxContent(
	{ className, side = "bottom", sideOffset = 6, align = "start", alignOffset = 0, anchor, ...props },
	ref,
): React.JSX.Element {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset} anchor={anchor} className="isolate z-popover">
				<ComboboxPrimitive.Popup
					ref={ref}
					data-slot="combobox-content"
					data-chips={!!anchor}
					className={cn(
						"group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+(--spacing(7)))] origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
});

// ── List ────────────────────────────────────────────────────────────────────

export interface ComboboxListProps extends Omit<ComboboxPrimitive.List.Props, "children"> {
	/** The option rows — always elements from the smart component (rule 9/10). */
	readonly children?: React.ReactNode;
	/** Overrides the default "Loading options…" row label (improvement 20). */
	readonly loadingLabel?: string;
}

export const ComboboxList = React.forwardRef<HTMLDivElement, ComboboxListProps>(function ComboboxList(
	{ className, children, loadingLabel = "Loading options…", ...props },
	ref,
): React.JSX.Element {
	const context = useComboboxContext();
	return (
		<ComboboxPrimitive.List
			ref={ref}
			data-slot="combobox-list"
			style={comboboxListMaxHeightStyle}
			className={cn("no-scrollbar max-h-(--combobox-list-max-h) scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0", className)}
			{...props}>
			{context.loading ? <ComboboxLoading label={loadingLabel} /> : null}
			{children}
		</ComboboxPrimitive.List>
	);
});

// ── Loading row (improvement 7 / feature 1) ─────────────────────────────────

export interface ComboboxLoadingProps {
	/** The loading message — always supplied by the smart component (rule 9). */
	readonly label: string;
	readonly className?: string;
}

export function ComboboxLoading({ label, className }: ComboboxLoadingProps): React.JSX.Element {
	return (
		<div data-slot="combobox-loading" role="status" aria-busy="true" className={cn("flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground", className)}>
			<Loader2Icon className="pointer-events-none size-4 shrink-0 animate-spin" />
			<span>{label}</span>
		</div>
	);
}

// ── Item ────────────────────────────────────────────────────────────────────

export interface ComboboxItemProps extends ComboboxPrimitive.Item.Props {
	/** Optional secondary line under the label (feature 13). */
	readonly description?: string;
}

export const ComboboxItem = React.forwardRef<HTMLDivElement, ComboboxItemProps>(function ComboboxItem({ className, children, description, ...props }, ref): React.JSX.Element {
	const context = useComboboxContext();

	const resolveItemClassName = useCallback(
		(state: ComboboxPrimitive.Item.State): string =>
			cn(
				"relative flex w-full cursor-default items-center gap-2 rounded-sm text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				resolveCollectionItemActiveClasses(state),
				resolveCollectionItemDensityClasses(context.size),
				className,
			),
		[context.size, className],
	);

	return (
		<ComboboxPrimitive.Item ref={ref} data-slot="combobox-item" className={resolveItemClassName} {...props}>
			<span className="min-w-0 flex-1 truncate">
				{description !== undefined ? (
					<span className="flex min-w-0 flex-col">
						<span className="truncate">{children}</span>
						<span className="truncate text-xs text-muted-foreground">{description}</span>
					</span>
				) : (
					<span className="block truncate">{children}</span>
				)}
			</span>
			<ComboboxPrimitive.ItemIndicator
				render={<span data-slot="combobox-item-indicator" className="pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center" />}>
				<CheckIcon className="pointer-events-none" />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
});

// ── Group / Label / Collection ──────────────────────────────────────────────

export const ComboboxGroup = React.forwardRef<HTMLDivElement, ComboboxPrimitive.Group.Props>(function ComboboxGroup({ className, ...props }, ref): React.JSX.Element {
	return <ComboboxPrimitive.Group ref={ref} data-slot="combobox-group" className={cn(className)} {...props} />;
});

export const ComboboxLabel = React.forwardRef<HTMLDivElement, ComboboxPrimitive.GroupLabel.Props>(function ComboboxLabel({ className, ...props }, ref): React.JSX.Element {
	return <ComboboxPrimitive.GroupLabel ref={ref} data-slot="combobox-label" className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
});

/**
 * Registers the item set with the root. Renders no DOM element (base-ui
 * collection parts are providers), so no ref is forwarded.
 */
export function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props): React.JSX.Element {
	return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

// ── Empty ───────────────────────────────────────────────────────────────────

export interface ComboboxEmptyProps extends ComboboxPrimitive.Empty.Props {
	/** The empty message — defaulted here but overridable for i18n (improvement 20). */
	readonly text?: string;
	/** Optional CTA for zero-result flows — e.g. "Create \"x\"" (feature 10). */
	readonly actionLabel?: string;
	/** Fired when the CTA is clicked. The smart component owns the outcome (rule 9/10). */
	readonly onAction?: () => void;
}

export const ComboboxEmpty = React.forwardRef<HTMLDivElement, ComboboxEmptyProps>(function ComboboxEmpty(
	{ className, text = "No results found", actionLabel, onAction, ...props },
	ref,
): React.JSX.Element {
	const hasAction = actionLabel !== undefined && onAction !== undefined;
	return (
		<ComboboxPrimitive.Empty
			ref={ref}
			data-slot="combobox-empty"
			className={cn("hidden w-full flex-col items-center gap-1.5 py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex", className)}
			{...props}>
			<span>{text}</span>
			{hasAction ? (
				<Button type="button" variant="link" size="sm" data-slot="combobox-empty-action" onClick={onAction} className="h-auto gap-1 p-0 text-xs no-underline hover:underline">
					<PlusIcon className="pointer-events-none size-3.5" />
					{actionLabel}
				</Button>
			) : null}
		</ComboboxPrimitive.Empty>
	);
});

// ── Separator ───────────────────────────────────────────────────────────────

export const ComboboxSeparator = React.forwardRef<HTMLDivElement, ComboboxPrimitive.Separator.Props>(function ComboboxSeparator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <ComboboxPrimitive.Separator ref={ref} data-slot="combobox-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
});

// ── Chips (multi-select) ────────────────────────────────────────────────────

export interface ComboboxChipsProps extends Omit<ComboboxPrimitive.Chips.Props, "children"> {
	/** The chips — always elements from the smart component (rule 9/10). */
	readonly children?: React.ReactNode;
	/** Maximum visible chips; extras collapse into a "+N more" chip (feature 9). */
	readonly maxChips?: number;
	/** Accessible name for the hidden "+N more" chip (improvement 3). */
	readonly overflowLabel?: string;
}

export const ComboboxChips = React.forwardRef<HTMLDivElement, ComboboxChipsProps>(function ComboboxChips(
	{ className, children, maxChips: maxChipsProp, overflowLabel = "More selected options", ...props },
	ref,
): React.JSX.Element {
	const context = useComboboxContext();
	const { size } = context;
	// The Root owns the cap (feature 9); a per-instance prop can override it.
	const maxChips = maxChipsProp ?? context.maxChips;

	// Feature 9: cap the visible chips. `React.Children.toArray` keeps keys, so
	// the remaining chips stay selected — only their visuals are hidden. The
	// overflow count derives from the *same* toArray length so fragments and
	// keyed children never skew the "+N more" number.
	const allChildren = useMemo(() => React.Children.toArray(children), [children]);
	const visibleChildren = useMemo(() => {
		if (maxChips === undefined || allChildren.length <= maxChips) {
			return allChildren;
		}
		return allChildren.slice(0, maxChips);
	}, [allChildren, maxChips]);

	const hiddenCount = allChildren.length - visibleChildren.length;

	return (
		<ComboboxPrimitive.Chips
			ref={ref}
			data-slot="combobox-chips"
			className={cn(
				"flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1.5 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
				// Improvement 2: chips density follows the root `size`.
				size === "sm" && "min-h-8",
				size === "default" && "min-h-9",
				size === "lg" && "min-h-10",
				className,
			)}
			{...props}>
			{visibleChildren}
			{hiddenCount > 0 ? (
				<span
					data-slot="combobox-chips-overflow"
					aria-label={overflowLabel}
					title={overflowLabel}
					className="flex h-[calc(--spacing(5.5))] w-fit items-center justify-center rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
					+{hiddenCount}
				</span>
			) : null}
		</ComboboxPrimitive.Chips>
	);
});

// ── Chip ────────────────────────────────────────────────────────────────────

export interface ComboboxChipProps extends ComboboxPrimitive.Chip.Props {
	/** Show the per-chip remove (x) button. */
	readonly showRemove?: boolean;
	/** Override the default "Remove <label>" aria-label (improvement 10). */
	readonly removeLabel?: string;
}

/**
 * A single selected chip. `React.memo` (rule 16, improvement 19): chips are
 * re-created on every keystroke in filter mode, and this prevents unrelated
 * chips from re-rendering when only one changes.
 */
export const ComboboxChip = React.memo(
	React.forwardRef<HTMLDivElement, ComboboxChipProps>(function ComboboxChip({ className, children, showRemove = true, removeLabel, ...props }, ref): React.JSX.Element {
		// Derive a sensible default remove label from the chip's text children
		// (rule 13: validate instead of branching on `typeof`).
		const derivedLabel = useMemo(() => {
			if (removeLabel !== undefined) {
				return removeLabel;
			}
			const text = extractStringChild(children);
			return text === undefined ? "Remove option" : `Remove ${text}`;
		}, [children, removeLabel]);

		return (
			<ComboboxPrimitive.Chip
				ref={ref}
				data-slot="combobox-chip"
				className={cn(
					"flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pe-0",
					className,
				)}
				{...props}>
				{children}
				{showRemove ? (
					<ComboboxPrimitive.ChipRemove
						render={<Button variant="ghost" size="icon-xs" />}
						aria-label={derivedLabel}
						className="-ms-1 opacity-50 hover:opacity-100"
						data-slot="combobox-chip-remove">
						<XIcon className="pointer-events-none" />
					</ComboboxPrimitive.ChipRemove>
				) : null}
			</ComboboxPrimitive.Chip>
		);
	}),
);

// ── Chips input ─────────────────────────────────────────────────────────────

export const ComboboxChipsInput = React.forwardRef<HTMLInputElement, ComboboxPrimitive.Input.Props>(function ComboboxChipsInput(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const context = useComboboxContext();
	const setRefs = useCallback(
		(node: HTMLInputElement | null): void => {
			context.registerInput(node);
			if (typeof ref === "function") {
				ref(node);
			} else if (ref !== null) {
				ref.current = node;
			}
		},
		[context, ref],
	);
	return <ComboboxPrimitive.Input ref={setRefs} data-slot="combobox-chip-input" className={cn("min-w-16 flex-1 outline-none", className)} {...props} />;
});

// ── Create-new row (feature 2) ──────────────────────────────────────────────

export interface ComboboxCreateProps extends React.ComponentPropsWithoutRef<"button"> {
	/** The typed query that would become the new option. */
	readonly query: string;
	/** Formats the create label, e.g. `(q) => \`Create "${q}"\`` (improvement 20). */
	readonly createLabel: (query: string) => string;
	/** Called with the query when the create action is chosen. */
	readonly onCreate: (query: string) => void;
}

/**
 * A "create new option" row rendered inside the list. It is fully controlled by
 * the smart component — the query comes in as a prop and `onCreate` hands it
 * back — so the primitive never owns option data (rule 9/10/11).
 */
export function ComboboxCreate({ query, createLabel, onCreate, className, ...props }: ComboboxCreateProps): React.JSX.Element {
	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.preventDefault();
			onCreate(query);
		},
		[onCreate, query],
	);

	return (
		<Button
			type="button"
			variant="nav"
			data-slot="combobox-create"
			className={cn(
				"h-auto justify-start gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground",
				className,
			)}
			onClick={handleClick}
			{...props}>
			<PlusIcon className="pointer-events-none size-4 shrink-0 text-primary" />
			<span className="truncate">{createLabel(query)}</span>
		</Button>
	);
}

// ── Clear-all (feature 12) ──────────────────────────────────────────────────

export interface ComboboxClearAllProps extends React.ComponentPropsWithoutRef<"button"> {
	/** Accessible name for the icon-only button (improvement 3). */
	readonly ariaLabel?: string;
}

/**
 * A selection-reset button for multi-select flows. The smart component owns the
 * selected values, so it supplies `onClick` — this is a styled button, not a
 * state owner (rule 9/10).
 */
export function ComboboxClearAll({ ariaLabel = "Clear all", className, children, ...props }: ComboboxClearAllProps): React.JSX.Element {
	return (
		<Button type="button" variant="ghost" size="icon-xs" aria-label={ariaLabel} data-slot="combobox-clear-all" className={cn(className)} {...props}>
			{children ?? <XIcon className="pointer-events-none" />}
		</Button>
	);
}
