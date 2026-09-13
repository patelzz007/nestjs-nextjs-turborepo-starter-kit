import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronDownIcon, GripVerticalIcon } from "lucide-react";
import { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Kbd } from "../display/kbd";

import {
	AccordionItemContext,
	type AccordionItemStatus,
	contentPaddingClasses,
	itemClasses,
	renderHighlightedLabel,
	renderStatusIcon,
	triggerClasses,
	useAccordionContext,
} from "./accordion-context";

// ── Item ────────────────────────────────────────────────────────────────────

export interface AccordionItemProps extends AccordionPrimitive.Item.Props {
	/** A unique value for this item. Required for `value`/`onValueChange`, `reorderable`, `hashSync` and the imperative API. */
	readonly value?: string;
	/** Mount panel children only after the first open (feature 11). */
	readonly lazy?: boolean;
	/** Move focus to the panel's first focusable element when opened (feature 15). */
	readonly autofocusContent?: boolean;
}

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
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

	const itemContextValue = useMemo(() => ({ lazy, hasOpened }), [lazy, hasOpened]);

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

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(function AccordionTrigger(
	{ className, children, sticky = false, icon, shortcut, count, status = "none", highlight, ...props },
	ref,
): React.JSX.Element {
	const context = useAccordionContext();
	const label = useMemo(() => renderHighlightedLabel(children, highlight), [children, highlight]);
	const statusIcon = useMemo(() => renderStatusIcon(status), [status]);

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
export const AccordionContent = forwardRef<HTMLDivElement, AccordionPrimitive.Panel.Props>(function AccordionContent(
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
