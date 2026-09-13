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
import { matchesShortcut, parseShortcut } from "@workspace/ui/lib/core/shortcut";
import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { describeSelection, SelectContext, type SelectContextValue, type SelectSize } from "./select-context";

// ── SSR guard ──────────────────────────────────────────────────────────────

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
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
} from "./select-parts";

export { selectSizeSchema } from "./select-context";

export { Select };
