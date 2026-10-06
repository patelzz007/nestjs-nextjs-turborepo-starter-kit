// ============================================================
// components/accordion.tsx
//
// Base UI Accordion, wrapped to satisfy the repo's 23 rules:
//   - CVA variant/size system + disabled state
//   - refs on every part + an imperative ref API (expandAll / collapseAll / …)
//   - `icon`, `shortcut`, `count`, `status` slots on the trigger
//   - search `highlight`, `lazy` mounting, `autofocusContent`, `sticky`
//   - drag-to-reorder (`reorderable` + `onReorder`)
//   - controlled `value`/`onValueChange` + `multiple` (base-ui's value is
//     ALWAYS an array — `string[]` — even in single mode)
//   - URL hash deep-linking (`hashSync`), sessionStorage persistence
//     (`persistKey`), print expand-all (`expandOnPrint`), headless mode
//     (base-ui `render` passes straight through)
//
// Data lives in the smart component / page. This file is presentational:
// every string you see is a prop or `children`, nothing is hardcoded.
// ============================================================

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@workspace/ui/lib/core/utils";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import {
	AccordionContext,
	accordionVariants,
	createImperativeChangeDetails,
	isBrowser,
	readPersistedAccordion,
	type AccordionSize,
	type AccordionVariant,
} from "./accordion-context";

// ── Imperative ref API (feature 9) ──────────────────────────────────────────

export interface AccordionRef {
	/** Opens every registered item. */
	expandAll(): void;
	/** Closes every registered item. */
	collapseAll(): void;
	/** Opens a single item by value (respects `multiple`). */
	expand(value: string): void;
	/** Closes a single item by value. */
	collapse(value: string): void;
	/** Toggles a single item by value. */
	toggle(value: string): void;
	/** The currently open values. */
	getValue(): readonly string[];
}

// ── Root ────────────────────────────────────────────────────────────────────

export interface AccordionProps extends AccordionPrimitive.Root.Props<string> {
	/** Visual treatment. `default` = divided list, `bordered` = tiles, `ghost` = plain, `flush` = corner-free. */
	readonly variant?: AccordionVariant;
	/** Density. */
	readonly size?: AccordionSize;
	/** Show separators between items (`false` removes dividers / tile gaps — improvements 11 + 20). */
	readonly separated?: boolean;
	/** Disable the open/close height animation (feature 18). */
	readonly animate?: boolean;
	/** Persist open items to `sessionStorage` (feature 10). Uncontrolled usage only. */
	readonly persistKey?: string;
	/** Deep-link via `location.hash` — opens `#<item id>` on mount and keeps the hash in sync (feature 17). */
	readonly hashSync?: boolean;
	/** Expand every item while printing, then restore (feature 19). */
	readonly expandOnPrint?: boolean;
	/** Enable drag-to-reorder (feature 5). Requires every `AccordionItem` to have a `value`. */
	readonly reorderable?: boolean;
	/** Called with the new order (as item values) after a drop (feature 5). */
	readonly onReorder?: (values: readonly string[]) => void;
	/** Accessible name for the accordion region when no visible heading exists (improvement 12). */
	readonly ariaLabel?: string;
}

const Accordion = forwardRef<AccordionRef, AccordionProps>(function Accordion(
	{
		className,
		children,
		value: valueProp,
		defaultValue: defaultValueProp,
		onValueChange: onValueChangeProp,
		variant = "default",
		size = "default",
		separated = true,
		animate = true,
		persistKey,
		hashSync = false,
		expandOnPrint = false,
		reorderable = false,
		onReorder,
		ariaLabel,
		...props
	},
	ref,
): React.JSX.Element {
	const rootDomRef = useRef<HTMLDivElement | null>(null);
	const registryRef = useRef<Map<string, string>>(new Map());
	const previousValueRef = useRef<string[]>([]);
	const onValueChangeRef = useRef(onValueChangeProp);

	// Keep the ref in sync without touching refs during render (react-compiler
	// rule) — `setValue` only ever runs from events/effects, so by the time it
	// fires the effect below has already committed the latest callback.
	useEffect(() => {
		onValueChangeRef.current = onValueChangeProp;
	}, [onValueChangeProp]);

	const [internalValue, setInternalValue] = useState<string[] | undefined>(() => {
		if (defaultValueProp !== undefined) {
			return defaultValueProp;
		}
		if (persistKey !== undefined) {
			return readPersistedAccordion(persistKey);
		}
		return undefined;
	});

	const isControlled = valueProp !== undefined;
	// Memoized so the derived array only changes when its inputs do — the
	// imperative API below depends on it (react-hooks/exhaustive-deps).
	// Note: TS narrows `valueProp` to a concrete array inside the `isControlled`
	// branch, so the fallback is only needed on the uncontrolled side.
	const resolvedValue: string[] = useMemo(() => (isControlled ? valueProp : (internalValue ?? [])), [isControlled, valueProp, internalValue]);

	/** Imperative/forwarding setter that works in both controlled and uncontrolled modes. */
	const setValue = useCallback(
		(next: string[]): void => {
			if (isControlled) {
				onValueChangeRef.current?.(next, createImperativeChangeDetails());
			} else {
				setInternalValue(next);
			}
		},
		[isControlled],
	);

	const handleValueChange = useCallback(
		(next: string[], details: AccordionPrimitive.Root.ChangeEventDetails): void => {
			onValueChangeProp?.(next, details);
			if (!isControlled) {
				setInternalValue(next);
			}
		},
		[onValueChangeProp, isControlled],
	);

	// Registry: item value -> DOM id (for hash linking, expand-all and reorder).
	const registerItem = useCallback((value: string, id: string): (() => void) => {
		registryRef.current.set(value, id);
		return (): void => {
			registryRef.current.delete(value);
		};
	}, []);

	const registeredValues = useCallback((): readonly string[] => [...registryRef.current.keys()], []);

	// ── Imperative API (feature 9) ──────────────────────────────────────────
	const expandAll = useCallback((): void => {
		const values = [...registeredValues()];
		const first = values[0];
		if (first === undefined) {
			return;
		}
		// A single-open accordion can only show one item — open the first.
		setValue(props.multiple ? values : [first]);
	}, [setValue, registeredValues, props.multiple]);

	const collapseAll = useCallback((): void => {
		setValue([]);
	}, [setValue]);

	const expand = useCallback(
		(value: string): void => {
			setValue(props.multiple ? [...new Set([...resolvedValue, value])] : [value]);
		},
		[setValue, resolvedValue, props.multiple],
	);

	const collapse = useCallback(
		(value: string): void => {
			setValue(resolvedValue.filter((entry) => entry !== value));
		},
		[setValue, resolvedValue],
	);

	const toggle = useCallback(
		(value: string): void => {
			setValue(resolvedValue.includes(value) ? resolvedValue.filter((entry) => entry !== value) : props.multiple ? [...new Set([...resolvedValue, value])] : [value]);
		},
		[setValue, resolvedValue, props.multiple],
	);

	useImperativeHandle(
		ref,
		(): AccordionRef => ({
			expandAll,
			collapseAll,
			expand,
			collapse,
			toggle,
			getValue: (): readonly string[] => [...resolvedValue],
		}),
		[expandAll, collapseAll, expand, collapse, toggle, resolvedValue],
	);

	// ── Drag-to-reorder (feature 5) — native DnD, no extra dependency ───────
	const [dragValue, setDragValueState] = useState<string | null>(null);

	const setDragValue = useCallback((value: string | null): void => {
		setDragValueState(value);
	}, []);

	const handleDrop = useCallback(
		(overValue: string): void => {
			const dragged = dragValue;
			if (dragged === null || dragged === overValue) {
				setDragValueState(null);
				return;
			}
			// Read the current order from the DOM (never trust the registry's
			// insertion order — React keeps items mounted across reorders).
			const nodes = rootDomRef.current?.querySelectorAll<HTMLElement>("[data-slot='accordion-item']");
			const ordered: string[] = [];
			nodes?.forEach((node) => {
				const entry = node.dataset.accordionValue;
				if (entry !== undefined) {
					ordered.push(entry);
				}
			});
			const from = ordered.indexOf(dragged);
			const to = ordered.indexOf(overValue);
			if (from === -1 || to === -1) {
				setDragValueState(null);
				return;
			}
			const next = [...ordered];
			next.splice(from, 1);
			next.splice(to, 0, dragged);
			onReorder?.(next);
			setDragValueState(null);
		},
		[dragValue, onReorder],
	);

	// ── Hash deep-linking (feature 17) ──────────────────────────────────────
	// Runs client-side only (effects never fire during SSR). Uses `setValue` —
	// not `setInternalValue` — so deep-linking also works on *controlled*
	// accordions (the imperative setter forwards through `onValueChange`).
	useEffect(() => {
		if (!isBrowser() || !hashSync) {
			return;
		}
		const id = window.location.hash.replace(/^#/, "");
		if (id === "") {
			return;
		}
		for (const [value, itemId] of registryRef.current) {
			if (itemId === id) {
				setValue([value]);
				break;
			}
		}
	}, [hashSync, setValue]);

	useEffect(() => {
		if (!isBrowser() || !hashSync) {
			return;
		}
		const openIds = resolvedValue.map((value) => registryRef.current.get(value)).filter((itemId): itemId is string => itemId !== undefined);
		const lastId = openIds[openIds.length - 1];
		if (lastId !== undefined && window.location.hash !== `#${lastId}`) {
			window.history.replaceState(null, "", `#${lastId}`);
		}
	}, [hashSync, resolvedValue]);

	// ── Persistence (feature 10) ────────────────────────────────────────────
	useEffect(() => {
		if (!isBrowser() || persistKey === undefined || isControlled) {
			return;
		}
		try {
			window.sessionStorage.setItem(persistKey, JSON.stringify(resolvedValue));
		} catch {
			// Storage unavailable (private mode) — persistence is best-effort.
		}
	}, [persistKey, isControlled, resolvedValue]);

	// ── Print expand-all (feature 19) ───────────────────────────────────────
	useEffect(() => {
		if (!isBrowser() || !expandOnPrint) {
			return;
		}
		const beforePrint = (): void => {
			previousValueRef.current = resolvedValue;
			setValue([...registeredValues()]);
		};
		const afterPrint = (): void => {
			setValue(previousValueRef.current);
		};
		window.addEventListener("beforeprint", beforePrint);
		window.addEventListener("afterprint", afterPrint);
		return (): void => {
			window.removeEventListener("beforeprint", beforePrint);
			window.removeEventListener("afterprint", afterPrint);
		};
	}, [expandOnPrint, resolvedValue, setValue, registeredValues]);

	const contextValue = useMemo(
		() => ({
			variant,
			size,
			separated,
			animate,
			reorderable,
			dragValue,
			registerItem,
			setDragValue,
			handleDrop,
		}),
		[variant, size, separated, animate, reorderable, dragValue, registerItem, setDragValue, handleDrop],
	);

	return (
		<AccordionContext.Provider value={contextValue}>
			<AccordionPrimitive.Root
				ref={rootDomRef}
				data-slot="accordion"
				aria-label={ariaLabel}
				className={cn(accordionVariants({ variant, size }), !separated && "gap-0", className)}
				// base-ui's `useControlled` freezes the controlled/uncontrolled decision
				// on first render, so we must always hand it a concrete array (never
				// `undefined`) — otherwise later imperative/persisted updates are ignored.
				value={isControlled ? valueProp : (internalValue ?? [])}
				onValueChange={handleValueChange}
				{...props}>
				{children}
			</AccordionPrimitive.Root>
		</AccordionContext.Provider>
	);
});

// ── Helpers / utils ─────────────────────────────────────────────────────────

/**
 * Measures the rendered height of an accordion panel — pair with `keepMounted`
 * on the Content to pre-measure content that contains late-loading images so
 * the open/close animation never jumps (feature 2).
 */
export function measureAccordionContent(element: HTMLElement): number {
	return element.scrollHeight;
}

/** Type guard: `Array.isArray` doesn't narrow `readonly` arrays under TS 7. */
function isStringArray(value: string | readonly string[]): value is readonly string[] {
	return Array.isArray(value);
}

/**
 * Normalizes a single value or array into base-ui's array form. base-ui's
 * `AccordionValue` is ALWAYS `string[]` — even in single mode — so `value="a"`
 * must become `value={["a"]}`.
 */
export function toAccordionValues(value: string | readonly string[]): string[] {
	if (isStringArray(value)) {
		return [...value];
	}
	return [value];
}

/** base-ui's value shape for the accordion (always an array). */
export type AccordionValue = string[];

export { AccordionContent, AccordionItem, AccordionTrigger } from "./accordion-parts";

export {
	accordionItemStatusSchema,
	accordionSizeSchema,
	accordionVariants,
	accordionVariantSchema,
	type AccordionItemStatus,
	type AccordionSize,
	type AccordionVariant,
	type AccordionVariantProps,
} from "./accordion-context";

export { Accordion };
