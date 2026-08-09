// ============================================================
// components/combobox.tsx
//
// Base UI Combobox, wrapped to satisfy the repo's 23 rules:
//   - CVA `size` (sm / default / lg) threaded through the InputGroup
//     and chips (rule 23, improvement 2)
//   - forwardRef on every DOM part (rule 20) + an imperative
//     `ComboboxRef` on the Root (focus / open / close / getValue)
//   - `loading` state rendering a spinner row in the list
//     (improvement 7 / feature 1)
//   - `maxSelected` guard with `onMaxSelectedReached` (feature 6) — vetoes
//     via `details.cancel()` so it works in uncontrolled mode too
//   - `maxChips` overflow chip ("+N more") on the chips row (feature 9)
//   - `shortcut` (e.g. "⌘K") to open + focus the input (feature 11)
//   - `debounceMs` on `onInputValueChange` for server-side search (feature 8)
//   - `persistQueryKey` restores + persists the draft query in sessionStorage
//     (feature 19) — SSR-safe
//   - `ComboboxEmpty` CTA (`actionLabel` + `onAction`) for zero-result flows
//     (feature 10)
//   - an sr-only `aria-live` region announcing the selection count (feature 20)
//   - `ComboboxCreate` "create new option" row (feature 2)
//   - `ComboboxClearAll` selection reset button (feature 12)
//   - `description` on items for two-line rows (feature 13)
//   - `removeLabel` on chips + `aria-label` on the clear button
//     (improvements 10 + 18) — no icon-only unlabeled buttons
//   - memoized `ComboboxChip` (rule 16, improvement 19)
//   - list max-height hoisted to a CSS custom property so the calc
//     runs once instead of per element (improvement 11)
//   - `formatValue`/`placeholder` on `ComboboxValue` (feature 7)
//   - `filter` passthrough for search-inside-results (feature 16); set
//     `filter={null}` for *remote* search so the server/smart layer owns
//     filtering (base-ui's client filter must not re-filter server results)
//   - `itemToStringLabel` / `itemToStringValue` passthrough for value != label
//     displays — base-ui fills the input with the selected item's *label* when
//     `itemToStringLabel` is set, otherwise the raw value leaks into the input
//   - all copy (empty text, create label, loading label) is a prop —
//     the smart component owns every string (rule 9/10/11, impr. 20)
//
// Data lives in the smart component / page. This file is presentational:
// values, options and labels arrive via props, nothing is fetched here.
// ============================================================

"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Button } from "@workspace/ui/components/form/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/form/input-group";
import { matchesShortcut, parseShortcut } from "@workspace/ui/lib/shortcut";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { z } from "zod";

// ── SSR guard ──────────────────────────────────────────────────────────────

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
}

// ── Zod schemas (rule 13: no inline unions, no `typeof` checks) ─────────────

/** The density of the combobox. */
const comboboxSizeSchema = z.enum(["sm", "default", "lg"]);

/** Validates the label of a chip — used to derive a default remove aria-label. */
const comboboxChipLabelSchema = z.string();

/** Validates a combobox value in form flows (rule 4: string keys are the norm). */
const comboboxChipValueSchema = z.string();

type ComboboxSize = z.infer<typeof comboboxSizeSchema>;

// ── Module-scope constants (rule 16: no per-render object/array creation) ──

/**
 * The list's max height, hoisted into a CSS custom property (improvement 11).
 * The calc is evaluated once by the browser instead of per list element, and
 * consumers can override `--combobox-list-max-h` at their own scope.
 */
/** CSS custom properties are kebab-case by spec; bypass the camelCase naming rule for this one. */
// eslint-disable-next-line @typescript-eslint/naming-convention
type ComboboxListMaxHeightStyle = React.CSSProperties & { readonly "--combobox-list-max-h": string };

const comboboxListMaxHeightStyle: ComboboxListMaxHeightStyle = {
	"--combobox-list-max-h": "min(calc(var(--spacing-72) - var(--spacing-9)), calc(var(--available-height) - var(--spacing-9)))",
};

// Keyboard shortcut parsing lives in `lib/shortcut.ts` (shared with Select).
// ── Shared context (threads Root options into the parts) ────────────────────

interface ComboboxContextValue {
	readonly size: ComboboxSize;
	readonly loading: boolean;
	/** Cap on visible chips — set on the Root, consumed by `ComboboxChips` (feature 9). */
	readonly maxChips: number | undefined;
	/** Registers the rendered input so the Root's shortcut handler can focus it. */
	readonly registerInput: (node: HTMLInputElement | null) => void;
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);

function useComboboxContext(): ComboboxContextValue {
	const context = useContext(ComboboxContext);
	if (context === null) {
		throw new Error("Combobox parts must be rendered inside <Combobox>.");
	}
	return context;
}

// ── Imperative ref API (rule 20, improvement 1) ─────────────────────────────

export interface ComboboxRef {
	/** Focuses the combobox input (and, on focus, base-ui opens the popup). */
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

/** The exact `onValueChange` signature base-ui expects (avoids a re-derivation mismatch). */
type ComboboxValueChange<Value, Multiple extends boolean | undefined = false> = NonNullable<ComboboxPrimitive.Root.Props<Value, Multiple>["onValueChange"]>;

// ── Root ────────────────────────────────────────────────────────────────────

export interface ComboboxProps<Value, Multiple extends boolean | undefined = false> extends ComboboxPrimitive.Root.Props<Value, Multiple> {
	/** The imperative handle. */
	readonly ref?: React.Ref<ComboboxRef>;
	/** Density of the input group, chips and items. */
	readonly size?: ComboboxSize;
	/** Show a spinner row inside the list while options load (feature 1). */
	readonly loading?: boolean;
	/** Keyboard shortcut that opens the popup and focuses the input, e.g. "⌘K" (feature 11). */
	readonly shortcut?: string;
	/** When set (multiple mode), further picks are blocked once reached (feature 6). */
	readonly maxSelected?: number;
	/** Called when a selection is blocked by `maxSelected` (feature 6). */
	readonly onMaxSelectedReached?: (max: number) => void;
	/** Cap on visible chips in multi-select mode — extras collapse into a "+N more" chip (feature 9). */
	readonly maxChips?: number;
	/** Accessible name for the region when there is no visible label (improvement 3). */
	readonly ariaLabel?: string;
	/** Debounce `onInputValueChange` by N ms — for server-side search (feature 8). */
	readonly debounceMs?: number;
	/** Restore + persist the draft query under this sessionStorage key (feature 19). */
	readonly persistQueryKey?: string;
}

/**
 * The combobox root. Renders no DOM element itself — it owns the state and
 * threads a config context into the parts. Uses React 19's ref-as-a-prop for
 * the generic handle (a generic forwardRef would lose its type parameters).
 *
 * Remote-search tips (props pass straight through to base-ui):
 * - pass `itemToStringLabel={(value) => label}` so the input shows the human
 *   label after a pick instead of the raw value (e.g. "JavaScript" not "js");
 * - pass `filter={null}` to disable base-ui's client-side filtering — the
 *   remote layer owns filtering, otherwise server results get re-filtered
 *   against the stale input text on reopen;
 * - drive `onInputValueChange` + `loading` for the async fetch itself.
 */
function Combobox<Value, Multiple extends boolean | undefined = false>({
	ref,
	size = "default",
	loading = false,
	shortcut,
	maxSelected,
	maxChips,
	onMaxSelectedReached,
	ariaLabel,
	debounceMs,
	persistQueryKey,
	open: openProp,
	defaultOpen = false,
	onOpenChange: onOpenChangeProp,
	onValueChange: onValueChangeProp,
	onInputValueChange: onInputValueChangeProp,
	...props
}: ComboboxProps<Value, Multiple>): React.JSX.Element {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const debounceTimerRef = useRef<number | null>(null);
	const [openState, setOpenState] = useState<boolean>(defaultOpen);
	const isOpenControlled = openProp !== undefined;

	// Feature 19: draft-query persistence. The lazy initializer runs once (SSR
	// guard included), then an effect writes every change back to sessionStorage.
	const [draftQuery, setDraftQuery] = useState<string | undefined>(() => {
		if (!isBrowser() || persistQueryKey === undefined) {
			return undefined;
		}
		const stored = window.sessionStorage.getItem(persistQueryKey);
		return stored ?? undefined;
	});

	// Feature 20: selection-count live region (announced to screen readers).
	const [selectionCount, setSelectionCount] = useState<number>(() => {
		if (Array.isArray(props.value)) {
			return props.value.length;
		}
		if (Array.isArray(props.defaultValue)) {
			return props.defaultValue.length;
		}
		if (props.value === undefined || props.value === null) {
			return 0;
		}
		return 1;
	});

	const registerInput = useCallback((node: HTMLInputElement | null): void => {
		inputRef.current = node;
	}, []);

	// `maxSelected` guard (feature 6): in multiple mode the value is an array —
	// veto the pick via `details.cancel()` when the cap is exceeded. `cancel()`
	// reverts base-ui's internal store, so the guard works in *both* controlled
	// and uncontrolled mode (without it, uncontrolled picks would still land).
	// Typed with the exact base-ui signature so the generics stay in sync.
	const handleValueChange: ComboboxValueChange<Value, Multiple> = useCallback(
		(value, details) => {
			if (maxSelected !== undefined && Array.isArray(value) && value.length > maxSelected) {
				details.cancel();
				onMaxSelectedReached?.(maxSelected);
				return;
			}
			setSelectionCount(Array.isArray(value) ? value.length : 1);
			onValueChangeProp?.(value, details);
		},
		[maxSelected, onMaxSelectedReached, onValueChangeProp],
	);

	// Feature 8: debounce the input-change notification. The timer is cleared on
	// every keystroke and on unmount — no stale timeouts after unmount.
	const handleInputValueChange = useCallback(
		(value: string, details: ComboboxPrimitive.Root.ChangeEventDetails): void => {
			if (persistQueryKey !== undefined) {
				setDraftQuery(value);
			}
			if (debounceMs === undefined || debounceMs <= 0) {
				onInputValueChangeProp?.(value, details);
				return;
			}
			if (debounceTimerRef.current !== null) {
				window.clearTimeout(debounceTimerRef.current);
			}
			debounceTimerRef.current = window.setTimeout((): void => {
				debounceTimerRef.current = null;
				onInputValueChangeProp?.(value, details);
			}, debounceMs);
		},
		[debounceMs, onInputValueChangeProp, persistQueryKey],
	);

	// Feature 19: persist the draft query on every change (browser only).
	useEffect(() => {
		if (!isBrowser() || persistQueryKey === undefined || draftQuery === undefined) {
			return;
		}
		window.sessionStorage.setItem(persistQueryKey, draftQuery);
	}, [persistQueryKey, draftQuery]);

	// Feature 8: clear a pending debounce on unmount.
	useEffect(() => {
		return (): void => {
			if (debounceTimerRef.current !== null) {
				window.clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	const handleOpenChange = useCallback(
		(open: boolean, details: ComboboxPrimitive.Root.ChangeEventDetails): void => {
			if (!isOpenControlled) {
				setOpenState(open);
			}
			onOpenChangeProp?.(open, details);
		},
		[isOpenControlled, onOpenChangeProp],
	);

	const open = isOpenControlled ? openProp : openState;

	const focus = useCallback((): void => {
		inputRef.current?.focus();
	}, []);

	const openCombobox = useCallback((): void => {
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
		(): ComboboxRef => ({
			focus,
			open: openCombobox,
			close,
		}),
		[focus, openCombobox, close],
	);

	// Keyboard shortcut (feature 11): a window-level listener that opens the
	// popup and focuses the input. Effects never run during SSR, and the
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
				openCombobox();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [shortcut, openCombobox]);

	const contextValue = useMemo<ComboboxContextValue>(() => ({ size, loading, maxChips, registerInput }), [size, loading, maxChips, registerInput]);

	return (
		<ComboboxContext.Provider value={contextValue}>
			<ComboboxPrimitive.Root
				aria-label={ariaLabel}
				open={open}
				onOpenChange={handleOpenChange}
				onValueChange={handleValueChange}
				onInputValueChange={handleInputValueChange}
				// Feature 19: seed the input with the persisted draft on first mount.
				// When no key is set, `draftQuery` stays undefined — passing it is inert.
				defaultInputValue={draftQuery}
				{...props}
			/>
			{/* Feature 20: sr-only selection-count announcement (multi-select). */}
			<span aria-live="polite" data-slot="combobox-live-region" className="sr-only">
				{selectionCount} selected
			</span>
		</ComboboxContext.Provider>
	);
}

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
function ComboboxValue({ children, formatValue, placeholder }: ComboboxValueProps & { readonly children?: React.ReactNode }): React.JSX.Element {
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

const ComboboxTrigger = React.forwardRef<HTMLButtonElement, ComboboxTriggerProps>(function ComboboxTrigger(
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

const ComboboxClear = React.forwardRef<HTMLButtonElement, ComboboxClearProps>(function ComboboxClear(
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
}

const ComboboxInput = React.forwardRef<HTMLInputElement, ComboboxInputProps>(function ComboboxInput(
	{ className, children, disabled = false, showTrigger = true, showClear = false, placeholder, ...props },
	ref,
): React.JSX.Element {
	const context = useComboboxContext();
	const { size } = context;

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
		<InputGroup
			className={cn(
				"w-auto",
				// Improvement 2: sizes. `cn` (tailwind-merge) lets these override the
				// InputGroup's base `h-9` without `!` battles.
				size === "sm" && "h-8",
				size === "lg" && "h-10",
				className,
			)}>
			<ComboboxPrimitive.Input ref={setRefs} render={<InputGroupInput disabled={disabled} aria-disabled={disabled || undefined} placeholder={placeholder} />} {...props} />
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

const ComboboxContent = React.forwardRef<HTMLDivElement, ComboboxContentProps>(function ComboboxContent(
	{ className, side = "bottom", sideOffset = 6, align = "start", alignOffset = 0, anchor, ...props },
	ref,
): React.JSX.Element {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset} anchor={anchor} className="isolate z-50">
				<ComboboxPrimitive.Popup
					ref={ref}
					data-slot="combobox-content"
					data-chips={!!anchor}
					className={cn(
						"group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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

const ComboboxList = React.forwardRef<HTMLDivElement, ComboboxListProps>(function ComboboxList(
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

function ComboboxLoading({ label, className }: ComboboxLoadingProps): React.JSX.Element {
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

const ComboboxItem = React.forwardRef<HTMLDivElement, ComboboxItemProps>(function ComboboxItem({ className, children, description, ...props }, ref): React.JSX.Element {
	const context = useComboboxContext();
	return (
		<ComboboxPrimitive.Item
			ref={ref}
			data-slot="combobox-item"
			className={cn(
				"relative flex w-full cursor-default items-center gap-2 rounded-sm text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				// Improvement 2: item density follows the root `size`.
				context.size === "sm" && "py-1 ps-2 pe-8",
				context.size === "default" && "py-1.5 ps-2 pe-8",
				context.size === "lg" && "py-2 ps-2.5 pe-8",
				className,
			)}
			{...props}>
			{description !== undefined ? (
				<span className="flex min-w-0 flex-col">
					<span className="truncate">{children}</span>
					<span className="truncate text-xs text-muted-foreground">{description}</span>
				</span>
			) : (
				children
			)}
			<ComboboxPrimitive.ItemIndicator
				render={<span data-slot="combobox-item-indicator" className="pointer-events-none absolute end-2 flex size-4 items-center justify-center" />}>
				<CheckIcon className="pointer-events-none" />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
});

// ── Group / Label / Collection ──────────────────────────────────────────────

const ComboboxGroup = React.forwardRef<HTMLDivElement, ComboboxPrimitive.Group.Props>(function ComboboxGroup({ className, ...props }, ref): React.JSX.Element {
	return <ComboboxPrimitive.Group ref={ref} data-slot="combobox-group" className={cn(className)} {...props} />;
});

const ComboboxLabel = React.forwardRef<HTMLDivElement, ComboboxPrimitive.GroupLabel.Props>(function ComboboxLabel({ className, ...props }, ref): React.JSX.Element {
	return <ComboboxPrimitive.GroupLabel ref={ref} data-slot="combobox-label" className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
});

/**
 * Registers the item set with the root. Renders no DOM element (base-ui
 * collection parts are providers), so no ref is forwarded.
 */
function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props): React.JSX.Element {
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

const ComboboxEmpty = React.forwardRef<HTMLDivElement, ComboboxEmptyProps>(function ComboboxEmpty(
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
				<button
					type="button"
					data-slot="combobox-empty-action"
					onClick={onAction}
					className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					<PlusIcon className="pointer-events-none size-3.5" />
					{actionLabel}
				</button>
			) : null}
		</ComboboxPrimitive.Empty>
	);
});

// ── Separator ───────────────────────────────────────────────────────────────

const ComboboxSeparator = React.forwardRef<HTMLDivElement, ComboboxPrimitive.Separator.Props>(function ComboboxSeparator({ className, ...props }, ref): React.JSX.Element {
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

const ComboboxChips = React.forwardRef<HTMLDivElement, ComboboxChipsProps>(function ComboboxChips(
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
const ComboboxChip = React.memo(
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

/** Reads a chip's plain-text child for the default remove label (rule 13). */
function extractStringChild(children: React.ReactNode): string | undefined {
	const parsed = comboboxChipLabelSchema.safeParse(children);
	return parsed.success ? parsed.data : undefined;
}

// ── Chips input ─────────────────────────────────────────────────────────────

const ComboboxChipsInput = React.forwardRef<HTMLInputElement, ComboboxPrimitive.Input.Props>(function ComboboxChipsInput({ className, ...props }, ref): React.JSX.Element {
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
function ComboboxCreate({ query, createLabel, onCreate, className, ...props }: ComboboxCreateProps): React.JSX.Element {
	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.preventDefault();
			onCreate(query);
		},
		[onCreate, query],
	);

	return (
		<button
			type="button"
			data-slot="combobox-create"
			className={cn(
				"flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
				className,
			)}
			onClick={handleClick}
			{...props}>
			<PlusIcon className="pointer-events-none size-4 shrink-0 text-primary" />
			<span className="truncate">{createLabel(query)}</span>
		</button>
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
function ComboboxClearAll({ ariaLabel = "Clear all", className, children, ...props }: ComboboxClearAllProps): React.JSX.Element {
	return (
		<Button type="button" variant="ghost" size="icon-xs" aria-label={ariaLabel} data-slot="combobox-clear-all" className={cn(className)} {...props}>
			{children ?? <XIcon className="pointer-events-none" />}
		</Button>
	);
}

// ── Anchor helper ───────────────────────────────────────────────────────────

function useComboboxAnchor(): React.RefObject<HTMLDivElement | null> {
	return React.useRef<HTMLDivElement | null>(null);
}

export {
	Combobox,
	ComboboxInput,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	ComboboxGroup,
	ComboboxLabel,
	ComboboxCollection,
	ComboboxEmpty,
	ComboboxSeparator,
	ComboboxChips,
	ComboboxChip,
	ComboboxChipsInput,
	ComboboxTrigger,
	ComboboxValue,
	ComboboxClear,
	ComboboxLoading,
	ComboboxCreate,
	ComboboxClearAll,
	useComboboxAnchor,
	comboboxSizeSchema,
	comboboxChipLabelSchema,
	comboboxChipValueSchema,
	type ComboboxSize,
};
