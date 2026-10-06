import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircleIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod";

/** The visual treatment of the whole accordion. */
export const accordionVariantSchema = z.enum(["default", "bordered", "ghost", "flush"]);

/** How dense the accordion is. */
export const accordionSizeSchema = z.enum(["sm", "default", "lg"]);

/** Trailing indicator that replaces the chevron. */
export const accordionItemStatusSchema = z.enum(["none", "loading", "done", "error"]);

/** Used to detect string-only trigger labels for `highlight`. */
const accordionLabelSchema = z.string();

export type AccordionVariant = z.infer<typeof accordionVariantSchema>;
export type AccordionSize = z.infer<typeof accordionSizeSchema>;
export type AccordionItemStatus = z.infer<typeof accordionItemStatusSchema>;

export const accordionVariants = cva("flex w-full flex-col", {
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

export type AccordionVariantProps = VariantProps<typeof accordionVariants>;

export interface AccordionContextValue {
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

export const AccordionContext = createContext<AccordionContextValue | null>(null);

export function useAccordionContext(): AccordionContextValue {
	const context = useContext(AccordionContext);
	if (context === null) {
		throw new Error("Accordion parts must be rendered inside <Accordion>.");
	}
	return context;
}

/** Per-item flags that `AccordionContent` needs (lazy mounting, feature 11). */
export interface AccordionItemContextValue {
	readonly lazy: boolean;
	readonly hasOpened: boolean;
}

export const AccordionItemContext = createContext<AccordionItemContextValue>({ lazy: false, hasOpened: true });

export function itemClasses(variant: AccordionVariant, separated: boolean, disabled: boolean): string {
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

export function triggerClasses(variant: AccordionVariant, size: AccordionSize): string {
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

export function contentPaddingClasses(variant: AccordionVariant, size: AccordionSize): string {
	return cn(
		size === "sm" && "pb-3 text-xs",
		size === "default" && "pb-4 text-sm",
		size === "lg" && "pb-5 text-base",
		variant === "bordered" && "px-3",
		variant === "ghost" && "px-2",
		(variant === "default" || variant === "flush") && "px-2",
	);
}

export function renderStatusIcon(status: AccordionItemStatus): ReactNode {
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
export function renderHighlightedLabel(children: ReactNode, highlight: string | undefined): ReactNode {
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
export function createImperativeChangeDetails(): AccordionPrimitive.Root.ChangeEventDetails {
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
export function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/** Reads persisted open items from sessionStorage (feature 10). SSR-safe. */
export function readPersistedAccordion(key: string): string[] | undefined {
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
