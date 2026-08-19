// ============================================================
// components/select.tsx
//
// Base UI Select, wrapped to satisfy the repo's 23 rules:
//   - CVA-style `size` (sm / default / lg) via zod `selectSizeSchema`,
//     threaded through the trigger AND items (rule 23, improvement 2)
//   - forwardRef on every DOM part (rule 20) + an imperative
//     `SelectRef` on the Root (focus / open / close)
//   - `loading` state rendering a spinner row in the list (feature 1)
//   - `SelectEmpty` zero-option row with optional CTA (feature 2)
//   - `shortcut` (e.g. "⌘K") to open + focus the trigger (feature 4)
//     — parsing lives in `lib/shortcut.ts`, shared with Combobox
//   - `formatValue` / `placeholder` on `SelectValue` (features 5 + 6)
//   - `SelectClear` pointer-assisted clear button (feature 7) — a
//     span with `role="button"` (a real <button> inside the trigger
//     <button> would be invalid HTML); the smart component renders it
//     only when a value is selected (rule 9/10)
//   - an sr-only `aria-live` region announcing the selection (feature 8)
//   - `variant="destructive"` + `description` on items (features 9 + 10)
//   - `fullWidth` trigger + `SelectArrow` part (features 11 + 13)
//   - sticky scroll-up/down arrows (improvement 15)
//   - `selectA11yProps()` helper for tests (feature 18)
//   - memoized `SelectItem` (rule 16, improvement 13)
//   - all copy (empty text, loading label, clear label) is a prop —
//     the smart component owns every string (rule 9/10/11, impr. 20)
//
// Data lives in the smart component / page. This file is presentational:
// values, options and labels arrive via props, nothing is fetched here.
// ============================================================

"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useStopPointerEvents } from "@workspace/ui/hooks/use-stop-pointer-events";
import { resolveFieldState } from "@workspace/ui/lib/field-state";
import { selectTriggerVariants } from "@workspace/ui/lib/field-variants";
import { matchesShortcut, parseShortcut } from "@workspace/ui/lib/shortcut";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { z } from "zod";

// ── SSR guard ──────────────────────────────────────────────────────────────

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
}

// ── Zod schemas (rule 13: no inline unions, no `typeof` checks) ─────────────

/** The density of the select. */
const selectSizeSchema = z.enum(["sm", "default", "lg"]);

type SelectSize = z.infer<typeof selectSizeSchema>;

// ── Shared context (threads Root options into the parts) ────────────────────

interface SelectContextValue {
	readonly size: SelectSize;
	readonly loading: boolean;
	/** Accessible name for the trigger when there is no visible label (improvement 3). */
	readonly ariaLabel: string | undefined;
	/** Validation state — threads to the trigger as `aria-invalid` (RHF/zod rule 18). */
	readonly invalid: boolean;
	/** Registers the rendered trigger so the Root's shortcut handler can focus it. */
	readonly registerTrigger: (node: HTMLButtonElement | null) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
	const context = useContext(SelectContext);
	if (context === null) {
		throw new Error("Select parts must be rendered inside <Select>.");
	}
	return context;
}

// ── Imperative ref API (rule 20, improvement 1) ─────────────────────────────

export interface SelectRef {
	/** Focuses the select trigger. */
	focus(): void;
	/**
	 * Programmatically opens the popup. In *uncontrolled* open mode this forces
	 * the popup open; in *controlled* open mode (`open` prop set) this only
	 * focuses — drive the popup through `open`/`onOpenChange` instead.
	 */
	open(): void;
	/** Programmatically closes the popup (uncontrolled open mode only). */
	close(): void;
}

/**
 * Describes a selection for the sr-only live region. Takes a plain, narrowable
 * union (base-ui's conditional `SelectValueType` can't be narrowed via
 * `Array.isArray`). Uses `itemToStringLabel` when available so the announcement
 * matches what the trigger shows (the label, never the raw value).
 */
function describeSelection<Value>(value: Value | Value[] | null, itemToStringLabel: ((itemValue: Value) => string) | undefined): string {
	if (Array.isArray(value)) {
		const labels = value.map((item) => itemToStringLabel?.(item) ?? String(item)).join(", ");
		return `${value.length.toString()} selected: ${labels}`;
	}
	if (value == null) {
		return "Nothing selected";
	}
	return `Selected ${itemToStringLabel?.(value) ?? String(value)}`;
}

// ── Root ────────────────────────────────────────────────────────────────────

export interface SelectProps<Value, Multiple extends boolean | undefined = false> extends SelectPrimitive.Root.Props<Value, Multiple> {
	/** The imperative handle. */
	readonly ref?: React.Ref<SelectRef>;
	/** Density of the trigger and items. */
	readonly size?: SelectSize;
	/** Show a spinner row inside the list while options load (feature 1). */
	readonly loading?: boolean;
	/** Keyboard shortcut that opens the popup and focuses the trigger, e.g. "⌘K" (feature 4). */
	readonly shortcut?: string;
	/** Accessible name for the trigger when there is no visible label (improvement 3). */
	readonly ariaLabel?: string;
	/** Validation state — threads to the trigger as `aria-invalid` for RHF/zod (rule 18). */
	readonly invalid?: boolean;
}

/**
 * The select root. Renders no DOM element itself — it owns the state and
 * threads a config context into the parts. Uses React 19's ref-as-a-prop for
 * the generic handle (a generic forwardRef would lose its type parameters).
 *
 * `itemToStringLabel` passes straight through to base-ui: when the stored
 * value differs from the displayed label (e.g. value "js", label "JavaScript")
 * it keeps the trigger, the live region and typeahead in sync with the label.
 */
function Select<Value, Multiple extends boolean | undefined = false>({
	ref,
	size = "default",
	loading = false,
	shortcut,
	ariaLabel,
	invalid = false,
	open: openProp,
	defaultOpen = false,
	onOpenChange: onOpenChangeProp,
	onValueChange: onValueChangeProp,
	itemToStringLabel,
	...props
}: SelectProps<Value, Multiple>): React.JSX.Element {
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const [openState, setOpenState] = useState<boolean>(defaultOpen);
	const isOpenControlled = openProp !== undefined;

	// Feature 8: sr-only selection announcement.
	const [liveLabel, setLiveLabel] = useState<string>("");

	const registerTrigger = useCallback((node: HTMLButtonElement | null): void => {
		triggerRef.current = node;
	}, []);

	const handleValueChange: NonNullable<SelectPrimitive.Root.Props<Value, Multiple>["onValueChange"]> = useCallback(
		(value, details) => {
			setLiveLabel(describeSelection(value, itemToStringLabel));
			onValueChangeProp?.(value, details);
		},
		[itemToStringLabel, onValueChangeProp],
	);

	const handleOpenChange = useCallback(
		(open: boolean, details: SelectPrimitive.Root.ChangeEventDetails): void => {
			if (!isOpenControlled) {
				setOpenState(open);
			}
			onOpenChangeProp?.(open, details);
		},
		[isOpenControlled, onOpenChangeProp],
	);

	const open = isOpenControlled ? openProp : openState;

	const focus = useCallback((): void => {
		triggerRef.current?.focus();
	}, []);

	const openSelect = useCallback((): void => {
		focus();
		if (!isOpenControlled) {
			setOpenState(true);
		}
	}, [focus, isOpenControlled]);

	const close = useCallback((): void => {
		if (!isOpenControlled) {
			setOpenState(false);
		}
	}, [isOpenControlled]);

	useImperativeHandle(
		ref,
		(): SelectRef => ({
			focus,
			open: openSelect,
			close,
		}),
		[focus, openSelect, close],
	);

	// Keyboard shortcut (feature 4): a window-level listener that opens the
	// popup and focuses the trigger. Effects never run during SSR, and the
	// listener is removed on unmount — no leaked global handlers.
	useEffect(() => {
		if (!isBrowser() || shortcut === undefined) {
			return;
		}
		const spec = parseShortcut(shortcut);
		if (spec === undefined) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent): void => {
			if (matchesShortcut(event, spec)) {
				event.preventDefault();
				openSelect();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [shortcut, openSelect]);

	const contextValue = useMemo<SelectContextValue>(() => ({ size, loading, ariaLabel, invalid, registerTrigger }), [size, loading, ariaLabel, invalid, registerTrigger]);

	return (
		<SelectContext.Provider value={contextValue}>
			<SelectPrimitive.Root open={open} onOpenChange={handleOpenChange} onValueChange={handleValueChange} itemToStringLabel={itemToStringLabel} {...props} />
			{/* Feature 8: sr-only selection announcement. */}
			<span aria-live="polite" data-slot="select-live-region" className="sr-only">
				{liveLabel}
			</span>
		</SelectContext.Provider>
	);
}

// ── Value ───────────────────────────────────────────────────────────────────

export interface SelectValueProps {
	/** Custom renderer for the selected value, e.g. avatars/badges (feature 5). */
	readonly formatValue?: (value: string) => React.ReactNode;
	/** The placeholder shown when nothing is selected (feature 6). */
	readonly placeholder?: React.ReactNode;
}

/**
 * Renders the currently selected value's label. When `formatValue` is set the
 * wrapper takes over rendering (so the placeholder can be styled muted too);
 * otherwise base-ui resolves the label from the selected item natively.
 */
function SelectValue({
	className,
	formatValue,
	placeholder,
	children,
}: SelectValueProps & { readonly className?: string; readonly children?: React.ReactNode }): React.JSX.Element {
	return (
		<SelectPrimitive.Value data-slot="select-value" placeholder={placeholder} className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-start", className)}>
			{formatValue !== undefined
				? (value: string | null): React.ReactNode => {
						if (value == null) {
							return placeholder === undefined ? null : <span className="truncate text-muted-foreground">{placeholder}</span>;
						}
						return <span className="truncate">{formatValue(value)}</span>;
					}
				: children}
		</SelectPrimitive.Value>
	);
}

// ── Trigger ─────────────────────────────────────────────────────────────────

export interface SelectTriggerProps extends SelectPrimitive.Trigger.Props {
	/** Density override — falls back to the Root's `size`. */
	readonly size?: SelectSize;
	/** Stretch the trigger to the full width of its container (feature 11). */
	readonly fullWidth?: boolean;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(function SelectTrigger(
	{ className, children, size: sizeProp, fullWidth = false, disabled, ...props },
	ref,
): React.JSX.Element {
	const context = useSelectContext();
	const size = sizeProp ?? context.size;

	// aria-label on the Root cannot reach the DOM (the Root renders nothing), so
	// the context threads it to the trigger here. An explicit trigger-level
	// aria-label always wins (improvement 3). Same for `aria-invalid` (rule 18).
	const triggerLabel = props["aria-label"] ?? context.ariaLabel;
	const triggerInvalid = props["aria-invalid"] ?? (context.invalid ? true : undefined);
	const fieldState = resolveFieldState({ disabled, loading: context.loading, ariaInvalid: triggerInvalid });

	const setRefs = useCallback(
		(node: HTMLButtonElement | null): void => {
			context.registerTrigger(node);
			if (typeof ref === "function") {
				ref(node);
			} else if (ref !== null) {
				ref.current = node;
			}
		},
		[context, ref],
	);

	return (
		<SelectPrimitive.Trigger
			ref={setRefs}
			aria-label={triggerLabel}
			aria-invalid={triggerInvalid}
			data-slot="select-trigger"
			data-size={size}
			className={cn(selectTriggerVariants({ size, state: fieldState }), fullWidth ? "w-full" : "w-fit", className)}
			{...props}>
			{children}
			<SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />} />
		</SelectPrimitive.Trigger>
	);
});

// ── Clear (feature 7) ───────────────────────────────────────────────────────

export interface SelectClearProps {
	/** Accessible name for the icon-only affordance (improvement 3). */
	readonly ariaLabel?: string;
	/** Fired when the clear affordance is activated. The smart component owns the outcome (rule 9/10). */
	readonly onClear: () => void;
	readonly className?: string;
}

/**
 * A pointer-assisted clear button rendered *inside* the trigger. It is a
 * `<span role="button">` (a real `<button>` inside the trigger `<button>`
 * would be invalid HTML) and stops event propagation so the trigger doesn't
 * toggle. Render it only when a value is selected — the smart component knows.
 */
function SelectClear({ ariaLabel = "Clear selection", onClear, className }: SelectClearProps): React.JSX.Element {
	// Shared stop-propagation handlers (with SelectChip) so the trigger never
	// toggles when the affordance is clicked (see hooks/use-stop-pointer-events).
	const { handlePointerDown, handleClick } = useStopPointerEvents(onClear);

	return (
		<span
			role="button"
			tabIndex={-1}
			aria-label={ariaLabel}
			data-slot="select-clear"
			onPointerDown={handlePointerDown}
			onClick={handleClick}
			className={cn(
				"-me-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				className,
			)}>
			<XIcon className="pointer-events-none size-3.5" />
		</span>
	);
}

// ── Multi-select chips (feature: multi) ────────────────────────────────────
//
// Multi-select (`<Select multiple>`) renders the chosen values as chips. The
// smart component owns the data (rule 9/10): it maps its values to
// `SelectChip` children with a label + a remove handler, and renders
// `SelectClearAll` beside the trigger when anything is selected.

export interface SelectChipsProps extends React.ComponentPropsWithoutRef<"div"> {
	/** Caps the number of visible chips; extras collapse into a “+N” pill (rule 11). */
	readonly maxChips?: number;
	/** Accessible label for the collapsed “+N” pill (improvement 20). */
	readonly overflowLabel?: string;
}

const SelectChips = React.forwardRef<HTMLDivElement, SelectChipsProps>(function SelectChips(
	{ className, children, maxChips, overflowLabel = "More selected options", ...props },
	ref,
): React.JSX.Element {
	// Cap the visible chips. `React.Children.toArray` keeps keys so the hidden
	// chips stay mounted; the overflow count derives from the same toArray.
	const allChildren = useMemo(() => React.Children.toArray(children), [children]);
	const visibleChildren = useMemo(() => {
		if (maxChips === undefined || allChildren.length <= maxChips) {
			return allChildren;
		}
		return allChildren.slice(0, maxChips);
	}, [allChildren, maxChips]);
	const hiddenCount = allChildren.length - visibleChildren.length;

	return (
		<div ref={ref} data-slot="select-chips" className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1", className)} {...props}>
			{visibleChildren}
			{hiddenCount > 0 ? (
				<span
					data-slot="select-chips-overflow"
					aria-label={overflowLabel}
					title={overflowLabel}
					className="flex h-[calc(--spacing(5.5))] w-fit items-center justify-center rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
					+{hiddenCount}
				</span>
			) : null}
		</div>
	);
});

export interface SelectChipProps {
	/** The display label — the smart component resolves it via its value→label map. */
	readonly label: React.ReactNode;
	/** The stored value, handed back to `onRemove` so the smart component needs no per-chip closure (rule 16). */
	readonly value: string;
	/** Accessible name for the remove affordance; defaults to “Remove {value}” (improvement 3). */
	readonly removeLabel?: string;
	/** Fired with the chip's `value` when the remove affordance is activated (rule 9/10). */
	readonly onRemove: (value: string) => void;
	readonly className?: string;
}

/**
 * A single selected-value chip. The remove affordance is a `<span role="button">`
 * (a real `<button>` inside the trigger `<button>` would be invalid HTML) and
 * stops event propagation so the trigger doesn't toggle. Rendered by the smart
 * component — it knows the value and the label (rule 9/10). The chip passes its
 * `value` back to `onRemove`, so the smart component binds one stable callback.
 */ const SelectChip = React.memo(
	React.forwardRef<HTMLDivElement, SelectChipProps>(function SelectChip({ className, label, value, removeLabel, onRemove, ...props }, ref): React.JSX.Element {
		const derivedLabel = removeLabel ?? `Remove ${value}`;

		// The activation callback is memoized FIRST (deps onRemove/value) so the
		// hook's click handler stays referentially stable across renders — the
		// same identity the pre-hook `useCallback` guaranteed (rule 16). The chip
		// reports its own `value`, so the smart component binds one stable
		// `onRemove`; the span's events are contained so the trigger never toggles.
		const handleRemoveChip = useCallback((): void => {
			onRemove(value);
		}, [onRemove, value]);
		const { handlePointerDown, handleClick: handleRemove } = useStopPointerEvents(handleRemoveChip);

		return (
			<div
				ref={ref}
				data-slot="select-chip"
				data-value={value}
				className={cn(
					"flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground",
					className,
				)}
				{...props}>
				<span className="truncate">{label}</span>
				<span
					role="button"
					tabIndex={-1}
					aria-label={derivedLabel}
					data-slot="select-chip-remove"
					onPointerDown={handlePointerDown}
					onClick={handleRemove}
					className="-me-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					<XIcon className="pointer-events-none size-3" />
				</span>
			</div>
		);
	}),
);

export interface SelectClearAllProps {
	/** Accessible name for the icon-only affordance (improvement 3). */
	readonly ariaLabel?: string;
	/** Fired when every selection is cleared. The smart component owns the outcome (rule 9/10). */
	readonly onClearAll: () => void;
	readonly className?: string;
}

/**
 * Clears every selection. Rendered *beside* the trigger by the smart component
 * when anything is selected (a real `<button>` — it lives outside the trigger).
 */
const SelectClearAll = React.forwardRef<HTMLButtonElement, SelectClearAllProps & React.ComponentPropsWithoutRef<"button">>(function SelectClearAll(
	{ className, ariaLabel = "Clear all selections", onClearAll, type = "button", children, ...props },
	ref,
): React.JSX.Element {
	return (
		<button
			ref={ref}
			type={type}
			aria-label={ariaLabel}
			data-slot="select-clear-all"
			onClick={onClearAll}
			className={cn(
				"inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				className,
			)}
			{...props}>
			{children ?? <XIcon className="pointer-events-none size-3.5" />}
		</button>
	);
});

// ── Content ─────────────────────────────────────────────────────────────────

export interface SelectContentProps
	extends SelectPrimitive.Popup.Props, Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"> {
	/** Overrides the default "Loading options…" row label (improvement 20 / feature 1). */
	readonly loadingLabel?: string;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(
	{ className, children, side = "bottom", sideOffset = 4, align = "center", alignOffset = 0, alignItemWithTrigger = true, loadingLabel = "Loading options…", ...props },
	ref,
): React.JSX.Element {
	const context = useSelectContext();
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className="z-popover isolate">
				<SelectPrimitive.Popup
					ref={ref}
					data-slot="select-content"
					className={cn(
						"z-popover relative isolate max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}>
					<SelectScrollUpButton />
					<SelectPrimitive.List data-slot="select-list" className="scroll-my-1 p-1">
						{context.loading ? <SelectLoading label={loadingLabel} /> : null}
						{children}
					</SelectPrimitive.List>
					<SelectScrollDownButton />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
});

// ── Loading row (feature 1) ─────────────────────────────────────────────────

interface SelectLoadingProps {
	/** The loading message — always supplied by the smart component (rule 9). */
	readonly label: string;
}

function SelectLoading({ label }: SelectLoadingProps): React.JSX.Element {
	return (
		<div data-slot="select-loading" role="status" aria-busy="true" className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
			<Loader2Icon className="pointer-events-none size-4 shrink-0 animate-spin" />
			<span>{label}</span>
		</div>
	);
}

// ── Group / Label ───────────────────────────────────────────────────────────

const SelectGroup = React.forwardRef<HTMLDivElement, SelectPrimitive.Group.Props>(function SelectGroup({ className, ...props }, ref): React.JSX.Element {
	return <SelectPrimitive.Group ref={ref} data-slot="select-group" className={cn("scroll-my-1 p-1", className)} {...props} />;
});

const SelectLabel = React.forwardRef<HTMLDivElement, SelectPrimitive.GroupLabel.Props>(function SelectLabel({ className, ...props }, ref): React.JSX.Element {
	return <SelectPrimitive.GroupLabel ref={ref} data-slot="select-label" className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
});

// ── Item ────────────────────────────────────────────────────────────────────

export interface SelectItemProps extends SelectPrimitive.Item.Props {
	/** Optional secondary line under the label (feature 10). */
	readonly description?: string;
	/** Destructive items (e.g. "Delete") keep a red tint even when highlighted (feature 9). */
	readonly variant?: "default" | "destructive";
}

/**
 * A single option row. `React.memo` (rule 16, improvement 13): select popups
 * re-render on open/highlight, and memoizing keeps unrelated rows from
 * re-rendering when only the highlighted/selected one changes.
 */
const SelectItem = React.memo(
	React.forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem({ className, children, description, variant = "default", ...props }, ref): React.JSX.Element {
		const context = useSelectContext();
		return (
			<SelectPrimitive.Item
				ref={ref}
				data-slot="select-item"
				data-variant={variant}
				className={cn(
					"relative flex w-full cursor-default items-center gap-2 rounded-sm text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
					// Improvement 2: item density follows the root `size`.
					context.size === "sm" && "py-1 ps-2 pe-8",
					context.size === "default" && "py-1.5 ps-2 pe-8",
					context.size === "lg" && "py-2 ps-2.5 pe-8",
					className,
				)}
				{...props}>
				<SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
					{description !== undefined ? (
						<span className="flex min-w-0 flex-col">
							<span className="truncate">{children}</span>
							<span className="truncate text-xs text-muted-foreground">{description}</span>
						</span>
					) : (
						children
					)}
				</SelectPrimitive.ItemText>
				<SelectPrimitive.ItemIndicator render={<span className="pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center" />}>
					<CheckIcon className="pointer-events-none" />
				</SelectPrimitive.ItemIndicator>
			</SelectPrimitive.Item>
		);
	}),
);

// ── Separator ───────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<HTMLDivElement, SelectPrimitive.Separator.Props>(function SelectSeparator({ className, ...props }, ref): React.JSX.Element {
	return <SelectPrimitive.Separator ref={ref} data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
});

// ── Scroll buttons (improvement 15) ─────────────────────────────────────────

const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>>(function SelectScrollUpButton(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<SelectPrimitive.ScrollUpArrow
			ref={ref}
			data-slot="select-scroll-up-button"
			className={cn("top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
			{...props}>
			<ChevronUpIcon />
		</SelectPrimitive.ScrollUpArrow>
	);
});

const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>>(function SelectScrollDownButton(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<SelectPrimitive.ScrollDownArrow
			ref={ref}
			data-slot="select-scroll-down-button"
			className={cn("bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
			{...props}>
			<ChevronDownIcon />
		</SelectPrimitive.ScrollDownArrow>
	);
});

// ── Arrow (feature 13) ──────────────────────────────────────────────────────

const SelectArrow = React.forwardRef<HTMLDivElement, SelectPrimitive.Arrow.Props>(function SelectArrow({ className, ...props }, ref): React.JSX.Element {
	return <SelectPrimitive.Arrow ref={ref} data-slot="select-arrow" className={cn("fill-popover", className)} {...props} />;
});

// ── Empty (feature 2) ───────────────────────────────────────────────────────

export interface SelectEmptyProps extends React.ComponentPropsWithoutRef<"div"> {
	/** The empty message — defaulted here but overridable for i18n (improvement 20). */
	readonly text?: string;
	/** Optional CTA for zero-option flows (feature 2). */
	readonly actionLabel?: string;
	/** Fired when the CTA is clicked. The smart component owns the outcome (rule 9/10). */
	readonly onAction?: () => void;
}

function SelectEmpty({ className, text = "No options", actionLabel, onAction, ...props }: SelectEmptyProps): React.JSX.Element {
	const hasAction = actionLabel !== undefined && onAction !== undefined;
	return (
		<div data-slot="select-empty" className={cn("flex w-full flex-col items-center gap-1.5 px-2 py-2 text-center text-sm text-muted-foreground", className)} {...props}>
			<span>{text}</span>
			{hasAction ? (
				<button
					type="button"
					data-slot="select-empty-action"
					onClick={onAction}
					className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					<PlusIcon className="pointer-events-none size-3.5" />
					{actionLabel}
				</button>
			) : null}
		</div>
	);
}

// ── A11y helper (feature 18) ────────────────────────────────────────────────

export interface SelectA11yContract {
	/** The trigger's role (supplied by base-ui). */
	readonly role: string;
	/** The popup type (supplied by base-ui). */
	readonly ariaHaspopup: string;
	/** The size data attribute the wrapper controls. */
	readonly dataSize: SelectSize;
}

/**
 * The computed a11y contract for a select trigger — lets tests assert the
 * wrapper-controlled attributes (data-size) alongside base-ui's own
 * (role/aria-haspopup) without hardcoding strings in the test.
 */
export function selectA11yProps(size: SelectSize): SelectA11yContract {
	return { role: "combobox", ariaHaspopup: "listbox", dataSize: size };
}

export {
	Select,
	SelectArrow,
	SelectChip,
	SelectChips,
	SelectClear,
	SelectClearAll,
	SelectContent,
	SelectEmpty,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	selectSizeSchema,
};
