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
//   - draft query persistence is owned by the smart parent via `defaultInputValue`
//     / controlled `inputValue` + `onInputValueChange` (parent may persist externally)
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
import { matchesShortcut, parseShortcut } from "@workspace/ui/lib/core/shortcut";
import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { ComboboxContext, type ComboboxSize } from "./combobox-context";

// ── SSR guard ──────────────────────────────────────────────────────────────

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
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
	/** Validation state — threads to the input group as `aria-invalid` (RHF/zod rule 18). */
	readonly invalid?: boolean;
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
	invalid = false,
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
		[debounceMs, onInputValueChangeProp],
	);

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

	const contextValue = useMemo(() => ({ size, loading, invalid, maxChips, registerInput }), [size, loading, invalid, maxChips, registerInput]);

	return (
		<ComboboxContext.Provider value={contextValue}>
			<ComboboxPrimitive.Root
				aria-label={ariaLabel}
				open={open}
				onOpenChange={handleOpenChange}
				onValueChange={handleValueChange}
				onInputValueChange={handleInputValueChange}
				{...props}
			/>
			{/* Feature 20: sr-only selection-count announcement (multi-select). */}
			<span aria-live="polite" data-slot="combobox-live-region" className="sr-only">
				{selectionCount} selected
			</span>
		</ComboboxContext.Provider>
	);
}

export {
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxClear,
	ComboboxClearAll,
	ComboboxCollection,
	ComboboxContent,
	ComboboxCreate,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxLoading,
	ComboboxSeparator,
	ComboboxTrigger,
	ComboboxValue,
} from "./combobox-parts";

export type { ComboboxValueProps } from "./combobox-parts";

export { comboboxChipLabelSchema, comboboxChipValueSchema, comboboxSizeSchema, useComboboxAnchor, type ComboboxSize } from "./combobox-context";

export { Combobox };
