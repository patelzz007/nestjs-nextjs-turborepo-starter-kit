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
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircleIcon, CheckIcon, ChevronDownIcon, GripVerticalIcon, Loader2Icon } from "lucide-react";
import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import { Kbd } from "../display/kbd";

// ── Zod schemas (rule 13: no inline unions, no `typeof` checks) ─────────────

/** The visual treatment of the whole accordion. */
const accordionVariantSchema = z.enum(["default", "bordered", "ghost", "flush"]);

/** How dense the accordion is. */
const accordionSizeSchema = z.enum(["sm", "default", "lg"]);

/** Trailing indicator that replaces the chevron. */
const accordionItemStatusSchema = z.enum(["none", "loading", "done", "error"]);

/** Used to detect string-only trigger labels for `highlight`. */
const accordionLabelSchema = z.string();

type AccordionVariant = z.infer<typeof accordionVariantSchema>;
type AccordionSize = z.infer<typeof accordionSizeSchema>;
type AccordionItemStatus = z.infer<typeof accordionItemStatusSchema>;

// ── CVA (rules 22 + 23) ──────────────────────────────────────────────────────

const accordionVariants = cva("flex w-full flex-col", {
	variants: {
		variant: {
			default: "",
			bordered: "gap-2",
			ghost: "",
			flush: "",
		},
		size: {
			sm: "",
			default: "",
			lg: "",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

type AccordionVariantProps = VariantProps<typeof accordionVariants>;

// ── Shared context (threads Root options into Item / Trigger / Content) ─────

interface AccordionContextValue {
	readonly variant: AccordionVariant;
	readonly size: AccordionSize;
	readonly separated: boolean;
	readonly animate: boolean;
	readonly reorderable: boolean;
	readonly dragValue: string | null;
	readonly registerItem: (value: string, id: string) => () => void;
	readonly setDragValue: (value: string | null) => void;
	readonly handleDrop: (overValue: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
	const context = useContext(AccordionContext);
	if (context === null) {
		throw new Error("Accordion parts must be rendered inside <Accordion>.");
	}
	return context;
}

/** Per-item flags that `AccordionContent` needs (lazy mounting, feature 11). */
interface AccordionItemContextValue {
	readonly lazy: boolean;
	readonly hasOpened: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextValue>({ lazy: false, hasOpened: true });

// ── Pure class helpers (module-scope, no per-render allocation) ─────────────

function itemClasses(variant: AccordionVariant, separated: boolean, disabled: boolean): string {
	return cn(
		"group/accordion-item overflow-hidden transition-colors",
		// Hover covers the WHOLE item (header + content), not just the header.
		"hover:bg-muted/40",
		// Default list style: a divider under every item except the last.
		variant === "default" && (separated ? "border-border not-last:border-b" : ""),
		// Card style: each item is its own rounded tile. The OPEN tile swaps its
		// plain border for a primary-tinted one + a soft shadow so the active
		// state reads as "selected", not "outlined".
		variant === "bordered" && "rounded-lg border border-border bg-card has-[[aria-expanded='true']]:border-primary/40 has-[[aria-expanded='true']]:shadow-sm",
		variant === "ghost" && "rounded-md",
		// Disabled state (improvement 3): `data-disabled` is set by this wrapper,
		// so the styling never depends on which attributes base-ui happens to emit.
		disabled && "pointer-events-none opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
	);
}

function triggerClasses(variant: AccordionVariant, size: AccordionSize): string {
	return cn(
		"group/accordion-trigger relative flex w-full flex-1 items-start justify-between gap-3 rounded-md border border-transparent text-start font-medium transition-colors outline-none",
		// Open-state tint. The header/content divider lives on the Panel
		// (`data-open:border-t`) so it stays a crisp edge-to-edge line instead of
		// following this trigger's rounded corners. The row hover lives on the
		// Item (whole content) — this trigger only tints when open (impr. 6 + 16).
		"aria-expanded:bg-muted/40",
		// Themed focus ring (not a plain black outline).
		"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25",
		// Disabled (improvement 3) — base-ui disables the button for a disabled item.
		"disabled:pointer-events-none disabled:opacity-50",
		// Left accent on the open item (improvement 6, RTL-aware via `start-0`).
		"before:absolute before:start-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity before:content-[''] aria-expanded:before:opacity-100",
		// Sizes (improvement 2) — `min-h-11` keeps a 44px touch target on mobile (improvement 10).
		size === "sm" && "min-h-11 py-2.5 text-xs",
		size === "default" && "py-4 text-sm",
		size === "lg" && "py-5 text-base",
		variant === "bordered" && "px-3",
		variant === "ghost" && "px-2",
		(variant === "default" || variant === "flush") && "px-2",
	);
}

function contentPaddingClasses(variant: AccordionVariant, size: AccordionSize): string {
	return cn(
		size === "sm" && "pb-3 text-xs",
		size === "default" && "pb-4 text-sm",
		size === "lg" && "pb-5 text-base",
		variant === "bordered" && "px-3",
		variant === "ghost" && "px-2",
		(variant === "default" || variant === "flush") && "px-2",
	);
}

function renderStatusIcon(status: AccordionItemStatus): ReactNode {
	if (status === "loading") {
		return <Loader2Icon data-slot="accordion-status-icon" className="pointer-events-none size-4 shrink-0 animate-spin text-muted-foreground" />;
	}
	if (status === "done") {
		return <CheckIcon data-slot="accordion-status-icon" className="pointer-events-none size-4 shrink-0 text-primary" />;
	}
	if (status === "error") {
		return <AlertCircleIcon data-slot="accordion-status-icon" className="pointer-events-none size-4 shrink-0 text-destructive" />;
	}
	return null;
}

/**
 * Wraps case-insensitive matches of `highlight` inside `<mark>` tags.
 * Only string labels are highlighted; anything richer passes through untouched
 * (the smart component owns the data, this just paints it — rule 9/11).
 */
function renderHighlightedLabel(children: ReactNode, highlight: string | undefined): ReactNode {
	const query = highlight?.trim();
	const parsed = accordionLabelSchema.safeParse(children);
	if (query === undefined || query === "" || !parsed.success) {
		return children;
	}
	const source = parsed.data;
	const lowerSource = source.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const segments: { readonly text: string; readonly match: boolean }[] = [];
	let cursor = 0;
	let at = lowerSource.indexOf(lowerQuery, cursor);
	while (at !== -1) {
		if (at > cursor) {
			segments.push({ text: source.slice(cursor, at), match: false });
		}
		segments.push({ text: source.slice(at, at + query.length), match: true });
		cursor = at + query.length;
		at = lowerSource.indexOf(lowerQuery, cursor);
	}
	if (cursor < source.length) {
		segments.push({ text: source.slice(cursor), match: false });
	}
	return segments.map((segment, index) =>
		segment.match ? (
			<mark key={`${index.toString()}-${segment.text}`} className="rounded-sm bg-accent px-0.5 text-accent-foreground">
				{segment.text}
			</mark>
		) : (
			<span key={`${index.toString()}-${segment.text}`}>{segment.text}</span>
		),
	);
}

/** Shared no-op for the imperative event-details actions (they're inert — see below). */
const noop = (): void => undefined;

/**
 * Builds the event-details object base-ui expects on `onValueChange`. The
 * imperative API isn't tied to a real user event, so we fabricate a neutral
 * `none`-reason payload (the same shape base-ui sends). `cancel` and
 * `allowPropagation` are genuinely inert here — there is no DOM event to
 * cancel or propagate — which is why they're shared no-ops.
 */
function createImperativeChangeDetails(): AccordionPrimitive.Root.ChangeEventDetails {
	return {
		reason: "none",
		event: new Event("change"),
		cancel: noop,
		allowPropagation: noop,
		isCanceled: false,
		isPropagationAllowed: true,
		trigger: undefined,
	};
}

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/** Reads persisted open items from sessionStorage (feature 10). SSR-safe. */
function readPersistedAccordion(key: string): string[] | undefined {
	if (!isBrowser()) {
		return undefined;
	}
	try {
		const raw = window.sessionStorage.getItem(key);
		if (raw === null) {
			return undefined;
		}
		const parsed = z.array(z.string()).safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

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

	const contextValue = useMemo<AccordionContextValue>(
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

// ── Item ────────────────────────────────────────────────────────────────────

export interface AccordionItemProps extends AccordionPrimitive.Item.Props {
	/** A unique value for this item. Required for `value`/`onValueChange`, `reorderable`, `hashSync` and the imperative API. */
	readonly value?: string;
	/** Mount panel children only after the first open (feature 11). */
	readonly lazy?: boolean;
	/** Move focus to the panel's first focusable element when opened (feature 15). */
	readonly autofocusContent?: boolean;
}
const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
	{ className, children, value, id, disabled = false, lazy = false, autofocusContent = false, onOpenChange, ...props },
	ref,
): React.JSX.Element {
	const context = useAccordionContext();
	const [hasOpened, setHasOpened] = useState(false);
	const itemDomRef = useRef<HTMLDivElement | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null): void => {
			itemDomRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref !== null) {
				ref.current = node;
			}
		},
		[ref],
	);

	// Register for hash linking / expand-all / reorder (feature 17, 9, 5).
	// `id` is only needed for hash deep-linking; expand-all and reorder work
	// with the value alone, so registration never requires an id.
	useEffect(() => {
		if (value === undefined) {
			return;
		}
		return context.registerItem(value, id ?? value);
	}, [context, value, id]);

	const handleOpenChange = useCallback(
		(open: boolean, details: AccordionPrimitive.Item.ChangeEventDetails): void => {
			if (open && lazy) {
				setHasOpened(true);
			}
			if (open && autofocusContent) {
				requestAnimationFrame(() => {
					const panel = itemDomRef.current?.querySelector<HTMLElement>("[data-slot='accordion-content']");
					const focusable = panel?.querySelector<HTMLElement>(
						"a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
					);
					focusable?.focus();
				});
			}
			onOpenChange?.(open, details);
		},
		[autofocusContent, lazy, onOpenChange],
	);

	// Native drag-to-reorder handlers (feature 5). Only attached when the Root opts in.
	const dragHandlers = useMemo(() => {
		if (!context.reorderable) {
			return {};
		}
		return {
			draggable: true,
			onDragStart: (event: React.DragEvent<HTMLDivElement>): void => {
				event.dataTransfer.effectAllowed = "move";
				context.setDragValue(value ?? "");
			},
			onDragOver: (event: React.DragEvent<HTMLDivElement>): void => {
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
			},
			onDrop: (event: React.DragEvent<HTMLDivElement>): void => {
				event.preventDefault();
				context.handleDrop(value ?? "");
			},
			onDragEnd: (): void => {
				context.setDragValue(null);
			},
		};
	}, [context, value]);

	const itemContextValue = useMemo<AccordionItemContextValue>(() => ({ lazy, hasOpened }), [lazy, hasOpened]);

	return (
		<AccordionPrimitive.Item
			ref={setRefs}
			id={id}
			value={value}
			disabled={disabled}
			data-slot="accordion-item"
			data-accordion-value={value}
			data-disabled={disabled ? "" : undefined}
			onOpenChange={handleOpenChange}
			className={cn(itemClasses(context.variant, context.separated, disabled), className)}
			{...props}
			{...dragHandlers}>
			<AccordionItemContext.Provider value={itemContextValue}>{children}</AccordionItemContext.Provider>
		</AccordionPrimitive.Item>
	);
});

// ── Trigger ─────────────────────────────────────────────────────────────────

export interface AccordionTriggerProps extends AccordionPrimitive.Trigger.Props {
	/** Pin the header to the top of the scroll container (feature 3). */
	readonly sticky?: boolean;
	/** Custom expand indicator rendered instead of the chevron (improvement 4). */
	readonly icon?: ReactNode;
	/** Keyboard-shortcut hint rendered in the trailing slot (feature 6). */
	readonly shortcut?: string;
	/** Trailing count badge, e.g. "Errors (3)" — the smart component owns the number (feature 8). */
	readonly count?: number | string;
	/** Trailing status icon that replaces the chevron (feature 12). */
	readonly status?: AccordionItemStatus;
	/** Search query; matching text inside a string label is highlighted (feature 4). */
	readonly highlight?: string;
}

const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(function AccordionTrigger(
	{ className, children, sticky = false, icon, shortcut, count, status = "none", highlight, ...props },
	ref,
): React.JSX.Element {
	const context = useAccordionContext();
	const label = useMemo<ReactNode>(() => renderHighlightedLabel(children, highlight), [children, highlight]);
	const statusIcon = useMemo<ReactNode>(() => renderStatusIcon(status), [status]);

	return (
		<AccordionPrimitive.Header className={cn("flex", sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm")}>
			<AccordionPrimitive.Trigger ref={ref} data-slot="accordion-trigger" className={cn(triggerClasses(context.variant, context.size), className)} {...props}>
				<span className="min-w-0 flex-1">{label}</span>
				<span className="flex shrink-0 items-center gap-2">
					{shortcut !== undefined ? <Kbd>{shortcut}</Kbd> : null}
					{count !== undefined ? (
						<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
							{count}
						</span>
					) : null}
					{context.reorderable ? (
						<GripVerticalIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/accordion-trigger:opacity-60" />
					) : null}
					{status !== "none" ? (
						statusIcon
					) : icon !== undefined ? (
						icon
					) : (
						<ChevronDownIcon
							data-slot="accordion-trigger-icon"
							className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180 motion-safe:transition-transform"
						/>
					)}
				</span>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
});

// ── Content ─────────────────────────────────────────────────────────────────

// `keepMounted` + `hiddenUntilFound` pass through from base-ui's Panel.Props,
// so there is nothing to add on top — we use the primitive's props type directly.

/**
 * The open/close body.
 *
 * `className` split (improvement 18): when `animate` is on (the default), the
 * outer Panel owns the height animation and `className` is merged onto the
 * **inner** wrapper div — the element whose padding/typography you usually want
 * to tweak. When `animate={false}`, there is no inner wrapper and `className`
 * lands on the Panel itself. If you ever need to restyle the outer Panel,
 * target `[data-slot='accordion-content']`.
 */
const AccordionContent = forwardRef<HTMLDivElement, AccordionPrimitive.Panel.Props>(function AccordionContent(
	{ className, children, ...props },
	ref,
): React.JSX.Element | null {
	const context = useAccordionContext();
	const itemContext = useContext(AccordionItemContext);
	const padding = useMemo(() => contentPaddingClasses(context.variant, context.size), [context.variant, context.size]);

	// Lazy mounting (feature 11): stay out of the DOM until the item has been
	// opened at least once. Only the panel is gated — the trigger always renders.
	if (itemContext.lazy && !itemContext.hasOpened) {
		return null;
	}

	if (!context.animate) {
		return (
			<AccordionPrimitive.Panel
				ref={ref}
				data-slot="accordion-content"
				className={cn("overflow-hidden data-open:border-t data-open:border-border", padding, className)}
				{...props}>
				{children}
			</AccordionPrimitive.Panel>
		);
	}

	return (
		<AccordionPrimitive.Panel
			ref={ref}
			data-slot="accordion-content"
			// The `data-open:border-t` is the crisp edge-to-edge divider between the
			// header and the body (user feedback 2026-08-06). base-ui sets
			// `data-open`/`data-closed` on the Panel itself, so the line appears the
			// moment the panel is open and disappears as it closes — no rounded
			// corners, no dependence on the trigger's shape.
			className="overflow-hidden data-open:border-t data-open:border-border motion-safe:data-open:animate-accordion-down motion-safe:data-closed:animate-accordion-up"
			{...props}>
			<div
				className={cn(
					"h-(--accordion-panel-height) pt-0 pb-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
					padding,
					className,
				)}>
				{children}
			</div>
		</AccordionPrimitive.Panel>
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

export {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	accordionItemStatusSchema,
	accordionSizeSchema,
	accordionVariants,
	accordionVariantSchema,
	type AccordionItemStatus,
	type AccordionSize,
	type AccordionVariant,
	type AccordionVariantProps,
};
