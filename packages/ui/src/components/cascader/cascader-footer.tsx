"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react";
import { useDirection } from "@base-ui/react/direction-provider";
import { isStringPrimitive } from "@workspace/shared";
import { useCascaderActions } from "@workspace/ui/components/cascader/cascader-context";
import { CASCADER_ACTION_CLASS, CascaderGroup, CascaderLabel } from "@workspace/ui/components/cascader/cascader-item";
import { CASCADER_LIST_PAD_CLASS, getCascaderFooterStops, isCascaderRtl } from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderActionItem } from "@workspace/ui/components/cascader/cascader-types";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

/**
 * The pinned footer, and the side-anchored flyout a footer row can open. These
 * are COMMANDS: nothing here joins the selection, the filter set or the
 * highlight. The flyout is a Base UI `Popover` rendered as a REACT CHILD of
 * `Combobox.Popup` with its OWN `Portal`: a DOM sibling of the combobox popup
 * (not clipped) but a React descendant, which is what the outside-press and
 * focus-out checks read. `Combobox` builds no `FloatingTree`, so one Escape
 * would dismiss both; `CascaderSubmenu` registers with the root to turn one
 * Escape into two.
 */

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

/** Keys the option list acts on, swallowed at the footer boundary. Escape and Tab are absent on purpose. */
const FOOTER_SWALLOWED_KEYS: ReadonlySet<string> = new Set(["Enter", " ", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/** Milliseconds between typeahead keystrokes before the buffer starts over. */
export const CASCADER_TYPEAHEAD_RESET_MS = 500;

const SUBMENU_CHEVRON = <ChevronRightIcon aria-hidden className="-me-0.5 size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />;

function focusedStopIndex(stops: readonly HTMLElement[], scope: HTMLElement): number {
	const active = scope.ownerDocument.activeElement;
	return stops.findIndex((stop: HTMLElement): boolean => stop === active);
}

export type CascaderFooterProps = React.ComponentPropsWithoutRef<"div">;

/**
 * Actions pinned below the list, a SIBLING of `CascaderList`. Children win
 * over the root's `actions` prop; with neither it renders nothing.
 */
const CascaderFooter = React.forwardRef<HTMLDivElement, CascaderFooterProps>(function CascaderFooter(
	{ className, children, onKeyDown, ...props },
	ref,
): React.JSX.Element | null {
	const { actions, labels } = useCascaderActions();
	const hasChildren = React.Children.count(children) > 0;

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || !FOOTER_SWALLOWED_KEYS.has(event.key)) {
				return;
			}
			event.stopPropagation();

			// The strip's own vertical movement, and the way back from the list's hand-off: either end returns focus to the search field.
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
				return;
			}
			const footer = event.currentTarget;
			const stops = getCascaderFooterStops(footer);
			const position = focusedStopIndex(stops, footer);
			if (position === -1) {
				return;
			}
			event.preventDefault();
			const next = event.key === "ArrowDown" ? stops.at(position + 1) : position > 0 ? stops.at(position - 1) : undefined;
			if (next !== undefined) {
				next.focus();
				return;
			}
			footer.closest<HTMLElement>('[data-slot="cascader-panel"]')?.querySelector<HTMLElement>('[data-slot="cascader-input"]')?.focus();
		},
		[onKeyDown],
	);

	if (!hasChildren && actions.length === 0) {
		return null;
	}

	return (
		<div
			ref={ref}
			data-slot="cascader-footer"
			// A named vertical toolbar: the commands move with the arrow keys, and the name says they are not more options.
			role="toolbar"
			aria-orientation="vertical"
			aria-label={labels.actionsLabel}
			onKeyDown={handleKeyDown}
			className={cn("flex shrink-0 flex-col gap-0.5 border-t border-border/60 p-(--cascader-list-pad)", CASCADER_LIST_PAD_CLASS, className)}
			{...props}>
			{hasChildren ? children : <CascaderFooterActions actions={actions} />}
		</div>
	);
});

interface CascaderActionsListProps {
	readonly actions: readonly CascaderActionItem[];
}

/** A stable key: the action's `value`, else its label when that is a string, else its position. */
function actionKey(action: CascaderActionItem, position: number): string {
	if (action.value !== undefined) {
		return action.value;
	}
	return isStringPrimitive(action.label) ? action.label : String(position);
}

function CascaderFooterActions({ actions }: CascaderActionsListProps): React.JSX.Element {
	return (
		<>
			{actions.map((action: CascaderActionItem, position: number): React.JSX.Element =>
				action.items !== undefined && action.items.length > 0 ? (
					<CascaderSubmenu key={actionKey(action, position)}>
						<CascaderSubmenuTrigger icon={action.icon} disabled={action.disabled}>
							{action.label}
						</CascaderSubmenuTrigger>
						<CascaderSubmenuContent>
							<CascaderActionList items={action.items} />
						</CascaderSubmenuContent>
					</CascaderSubmenu>
				) : (
					<CascaderAction key={actionKey(action, position)} icon={action.icon} disabled={action.disabled} onSelect={action.onSelect}>
						{action.label}
					</CascaderAction>
				),
			)}
		</>
	);
}

interface CascaderActionRun {
	readonly group: string | undefined;
	readonly items: readonly CascaderActionItem[];
}

/** Consecutive entries sharing a `group`, as runs not buckets: two separated runs with the same name stay two. */
export function groupCascaderActionRuns(items: readonly CascaderActionItem[]): CascaderActionRun[] {
	const runs: { group: string | undefined; items: CascaderActionItem[] }[] = [];
	for (const item of items) {
		const last = runs.at(-1);
		if (last?.group === item.group && last !== undefined) {
			last.items.push(item);
		} else {
			runs.push({ group: item.group, items: [item] });
		}
	}
	return runs;
}

interface CascaderActionListEntryProps {
	readonly item: CascaderActionItem;
}

/** One flyout command: it runs, then closes the flyout behind it, or the entries would read as toggles. */
function CascaderActionListEntry({ item }: CascaderActionListEntryProps): React.JSX.Element {
	const { close } = useCascaderSubmenu();
	const { onSelect } = item;
	const handleSelect = React.useCallback((): void => {
		onSelect?.();
		close();
	}, [onSelect, close]);

	return (
		<CascaderAction icon={item.icon} disabled={item.disabled} onSelect={handleSelect}>
			{item.label}
		</CascaderAction>
	);
}

interface CascaderActionListProps {
	readonly items: readonly CascaderActionItem[];
}

/** Flyout body for a data-driven submenu. A named run becomes a real `CascaderGroup`; unnamed runs stay unwrapped. */
function CascaderActionList({ items }: CascaderActionListProps): React.JSX.Element {
	const runs = React.useMemo((): CascaderActionRun[] => groupCascaderActionRuns(items), [items]);

	return (
		<>
			{runs.map((run: CascaderActionRun, runIndex: number): React.JSX.Element => (
				<React.Fragment key={`${run.group ?? ""}:${actionKey(run.items.at(0) ?? { label: "" }, runIndex)}`}>
					{run.group === undefined ? (
						run.items.map((item: CascaderActionItem, position: number): React.JSX.Element => <CascaderActionListEntry key={actionKey(item, position)} item={item} />)
					) : (
						<CascaderGroup className="gap-0.5">
							<CascaderLabel>{run.group}</CascaderLabel>
							{run.items.map((item: CascaderActionItem, position: number): React.JSX.Element => (
								<CascaderActionListEntry key={actionKey(item, position)} item={item} />
							))}
						</CascaderGroup>
					)}
				</React.Fragment>
			))}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Action                                   */
/* -------------------------------------------------------------------------- */

export interface CascaderActionProps extends Omit<React.ComponentPropsWithoutRef<"button">, "onSelect"> {
	readonly icon?: React.ReactNode;
	/** Fires on press, after `onClick`, and not at all when disabled. */
	readonly onSelect?: (() => void) | undefined;
}

const FLYOUT_SURFACE_CLASS =
	"max-h-72 overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

/**
 * One footer command, shaped like a row and deliberately NOT one: a real
 * `<button>`, never a `Combobox.Item`, so it never joins the arrow-key ring or
 * vanishes when a query matches nothing. Disabled is `aria-disabled`, never
 * the native attribute, so it stays a tab stop.
 */
const CascaderAction = React.forwardRef<HTMLButtonElement, CascaderActionProps>(function CascaderAction(
	{ className, icon, children, onSelect, onClick, onKeyDown, disabled = false, ...props },
	ref,
): React.JSX.Element {
	// Set by `CascaderSubmenuContent`: a plain button in the footer's Tab ring, a roving-focus `menuitem` inside a flyout.
	const inMenu = React.useContext(CascaderMenuContext);

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Before the consumer's handler: a disabled command runs none of them.
			if (disabled) {
				event.preventDefault();
				return;
			}
			onClick?.(event);
			if (!event.defaultPrevented) {
				onSelect?.();
			}
		},
		[disabled, onClick, onSelect],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>): void => {
			if (disabled) {
				// The two keys a `<button>` activates on, and only those.
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
				}
				return;
			}
			onKeyDown?.(event);
		},
		[disabled, onKeyDown],
	);

	return (
		<button
			ref={ref}
			type="button"
			data-slot="cascader-action"
			aria-disabled={disabled ? true : undefined}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role={inMenu ? "menuitem" : undefined}
			tabIndex={inMenu ? -1 : undefined}
			className={cn(CASCADER_ACTION_CLASS, className)}
			{...props}>
			{icon === undefined ? null : (
				<span data-slot="cascader-action-icon" className="flex shrink-0 items-center justify-center text-muted-foreground">
					{icon}
				</span>
			)}
			<span className="min-w-0 flex-1 truncate text-start">{children}</span>
		</button>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Submenu                                   */
/* -------------------------------------------------------------------------- */

export interface CascaderSubmenuContextValue {
	readonly rowRef: React.RefObject<HTMLButtonElement | null>;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	readonly close: () => void;
	/** Names the flyout: a menu is labelled by the control that opens it. */
	readonly triggerId: string;
	/** Whether the pending open came from the KEYBOARD, so focus lands on the first entry. A ref, so reading it in the focus phase cannot render. */
	readonly keyboardRef: React.RefObject<boolean>;
}

/** Marks the subtree INSIDE a flyout. See `inMenu` in `CascaderAction`. */
const CascaderMenuContext = React.createContext(false);

/** Every entry a menu's roving focus may land on, in DOM order. A disabled `CascaderAction` is INCLUDED: it carries `aria-disabled`. */
function menuItems(popup: HTMLElement | null): HTMLElement[] {
	if (popup === null) {
		return [];
	}
	return Array.from(popup.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
}

const CascaderSubmenuContext = React.createContext<CascaderSubmenuContextValue | null>(null);

/** The flyout's own state. `close()` is the one a custom entry usually wants. */
export function useCascaderSubmenu(): CascaderSubmenuContextValue {
	const context = React.useContext(CascaderSubmenuContext);
	if (context === null) {
		throw new Error("useCascaderSubmenu must be used within a CascaderSubmenu");
	}
	return context;
}

export interface CascaderSubmenuProps {
	readonly open?: boolean | undefined;
	readonly defaultOpen?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	readonly children?: React.ReactNode;
}

/**
 * A footer row plus the flyout it opens. Renders no element of its own (the
 * trigger and the content do), so there is no ref to forward. Registers with
 * the cascader root while open, which turns one Escape into two; cleared in
 * an EFFECT, so the flyout still reads as open during the event that closed it.
 */
function CascaderSubmenu({ open: openProp, defaultOpen = false, onOpenChange, children }: CascaderSubmenuProps): React.JSX.Element {
	const { setFlyoutOpen } = useCascaderActions();
	const key = React.useId();
	const triggerId = React.useId();
	const rowRef = React.useRef<HTMLButtonElement | null>(null);
	const keyboardRef = React.useRef(false);
	const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
	const open = openProp ?? uncontrolled;

	const setOpen = React.useCallback(
		(next: boolean): void => {
			if (openProp === undefined) {
				setUncontrolled(next);
			}
			onOpenChange?.(next);
		},
		[openProp, onOpenChange],
	);

	const close = React.useCallback((): void => {
		setOpen(false);
	}, [setOpen]);

	React.useEffect((): (() => void) => {
		setFlyoutOpen(key, open);
		return (): void => {
			setFlyoutOpen(key, false);
		};
	}, [setFlyoutOpen, key, open]);

	const context = React.useMemo((): CascaderSubmenuContextValue => ({ rowRef, open, setOpen, close, triggerId, keyboardRef }), [open, setOpen, close, triggerId]);

	return (
		<CascaderSubmenuContext.Provider value={context}>
			{/* NEVER modal: it would disable the combobox that owns it. */}
			<PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
				{children}
			</PopoverPrimitive.Root>
		</CascaderSubmenuContext.Provider>
	);
}

export interface CascaderSubmenuTriggerProps extends Omit<React.ComponentPropsWithoutRef<"button">, "onSelect"> {
	readonly icon?: React.ReactNode;
}

/** Carries the handler-veto hook, derived so a Base UI bump cannot drift. */
type CascaderSubmenuTriggerClickEvent = Parameters<NonNullable<PopoverPrimitive.Trigger.Props["onClick"]>>[0];

/**
 * The footer row that opens the flyout, and its anchor. `aria-haspopup="menu"`:
 * what opens is a list of commands with roving focus. `disabled` is published
 * as `aria-disabled` and enforced by hand, so the row stays in the Tab ring.
 */
const CascaderSubmenuTrigger = React.forwardRef<HTMLButtonElement, CascaderSubmenuTriggerProps>(function CascaderSubmenuTrigger(
	{ className, icon, children, onKeyDown, onClick, disabled = false, ...props },
	ref,
): React.JSX.Element {
	const { labels } = useCascaderActions();
	const { rowRef, setOpen, triggerId, keyboardRef } = useCascaderSubmenu();
	const direction = useDirection();

	const setRowRef = React.useCallback(
		(element: HTMLButtonElement | null): void => {
			rowRef.current = element;
			assignRef(ref, element);
		},
		[rowRef, ref],
	);

	const handleClick = React.useCallback(
		(event: CascaderSubmenuTriggerClickEvent): void => {
			if (disabled) {
				event.preventDefault();
				event.preventBaseUIHandler();
				return;
			}
			onClick?.(event);
		},
		[disabled, onClick],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>): void => {
			if (disabled) {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
				}
				return;
			}
			onKeyDown?.(event);
			if (event.defaultPrevented) {
				return;
			}
			// Enter and Space open through the button's own click, so only FLAGGED.
			if (event.key === "Enter" || event.key === " ") {
				keyboardRef.current = true;
				return;
			}
			// The opening key points AT the flyout, so it flips with the writing direction.
			const openKey = isCascaderRtl(event.currentTarget, direction) ? "ArrowLeft" : "ArrowRight";
			if (event.key !== openKey) {
				return;
			}
			event.preventDefault();
			keyboardRef.current = true;
			setOpen(true);
		},
		[disabled, onKeyDown, direction, setOpen, keyboardRef],
	);

	return (
		<PopoverPrimitive.Trigger
			ref={setRowRef}
			id={triggerId}
			data-slot="cascader-submenu-trigger"
			aria-haspopup="menu"
			aria-disabled={disabled ? true : undefined}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={cn(CASCADER_ACTION_CLASS, "aria-expanded:bg-accent aria-expanded:text-accent-foreground", className)}
			{...props}>
			{icon === undefined ? null : (
				<span data-slot="cascader-action-icon" className="flex shrink-0 items-center justify-center text-muted-foreground">
					{icon}
				</span>
			)}
			<span className="min-w-0 flex-1 truncate text-start">{children}</span>
			{/* Nothing else says the row opens a MENU, not another tree level. */}
			<span className="sr-only">, {labels.submenuAffordance}</span>
			{SUBMENU_CHEVRON}
		</PopoverPrimitive.Trigger>
	);
});

export interface CascaderSubmenuContentProps extends PopoverPrimitive.Popup.Props, Pick<PopoverPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset"> {}

/** Carries Base UI's handler-veto hook, so a plain React event will not do. */
type CascaderSubmenuKeyEvent = Parameters<NonNullable<PopoverPrimitive.Popup.Props["onKeyDown"]>>[0];

interface CascaderTypeahead {
	buffer: string;
	at: number;
}

/** The flyout itself, a `role="menu"` with roving focus, named by its row. */
const CascaderSubmenuContent = React.forwardRef<HTMLDivElement, CascaderSubmenuContentProps>(function CascaderSubmenuContent(
	{ className, children, onKeyDown, side = "inline-end", align = "end", sideOffset = 8, alignOffset = 0, ...props },
	ref,
): React.JSX.Element {
	const { rowRef, close, triggerId, keyboardRef } = useCascaderSubmenu();
	const direction = useDirection();
	const popupRef = React.useRef<HTMLDivElement | null>(null);
	const typeaheadRef = React.useRef<CascaderTypeahead>({ buffer: "", at: 0 });

	const setPopupRef = React.useCallback(
		(element: HTMLDivElement | null): void => {
			popupRef.current = element;
			assignRef(ref, element);
		},
		[ref],
	);

	// Keyboard opens land on the first entry; a pointer open falls through to Base UI's default, the popup, so a click paints no focus ring.
	const initialFocus = React.useCallback((): HTMLElement | true => {
		const byKeyboard = keyboardRef.current;
		keyboardRef.current = false;
		if (!byKeyboard) {
			return true;
		}
		const [first] = menuItems(popupRef.current);
		return first ?? true;
	}, [keyboardRef]);

	const closeAndReturn = React.useCallback((): void => {
		close();
		rowRef.current?.focus();
	}, [close, rowRef]);

	const handleKeyDown = React.useCallback(
		(event: CascaderSubmenuKeyEvent): void => {
			onKeyDown?.(event);
			// A DOM sibling of the combobox popup but a REACT descendant, so keys in here reach its handlers unless stopped.
			event.stopPropagation();
			if (event.defaultPrevented) {
				return;
			}

			const items = menuItems(popupRef.current);
			if (items.length === 0) {
				return;
			}
			const active = event.currentTarget.ownerDocument.activeElement;
			const position = items.findIndex((item: HTMLElement): boolean => item === active);
			const move = (next: number): void => {
				event.preventDefault();
				items.at((next + items.length) % items.length)?.focus();
			};
			const closeKey = isCascaderRtl(event.currentTarget, direction) ? "ArrowRight" : "ArrowLeft";

			switch (event.key) {
				case "ArrowDown":
					move(position + 1);
					return;
				case "ArrowUp":
					// From the popup itself (a pointer open) Up means the LAST entry.
					move(position === -1 ? items.length - 1 : position - 1);
					return;
				case "Home":
					move(0);
					return;
				case "End":
					move(items.length - 1);
					return;
				case closeKey:
					event.preventDefault();
					closeAndReturn();
					return;
				case "Tab":
					// A menu never holds Tab: it closes and focus carries on from its row.
					closeAndReturn();
					return;
				default:
					break;
			}

			// Typeahead, after the switch so it can never swallow a navigation key.
			if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			const state = typeaheadRef.current;
			state.buffer = event.timeStamp - state.at > CASCADER_TYPEAHEAD_RESET_MS ? event.key : state.buffer + event.key;
			state.at = event.timeStamp;
			const prefix = state.buffer.toLocaleLowerCase();
			const from = position === -1 ? 0 : position;
			// Starts AFTER the current entry so one letter cycles rather than sticks.
			const pivot = state.buffer.length > 1 ? from : from + 1;
			const ordered = [...items.slice(pivot), ...items.slice(0, pivot)];
			const hit = ordered.find((item: HTMLElement): boolean => item.textContent.trim().toLocaleLowerCase().startsWith(prefix));
			if (hit !== undefined) {
				event.preventDefault();
				hit.focus();
			}
		},
		[onKeyDown, direction, closeAndReturn],
	);

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner anchor={rowRef} side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} className="isolate z-popover">
				<PopoverPrimitive.Popup
					ref={setPopupRef}
					initialFocus={initialFocus}
					data-slot="cascader-submenu-content"
					role="menu"
					aria-orientation="vertical"
					aria-labelledby={triggerId}
					tabIndex={-1}
					onKeyDown={handleKeyDown}
					className={cn(
						FLYOUT_SURFACE_CLASS,
						"flex max-w-(--available-width) min-w-48 flex-col gap-0.5 p-(--cascader-list-pad) outline-hidden",
						CASCADER_LIST_PAD_CLASS,
						className,
					)}
					{...props}>
					<CascaderMenuContext.Provider value>{children}</CascaderMenuContext.Provider>
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
});

/** Whether the footer would render anything, for a wrapper that has to make the same call `CascaderFooter` already makes. */
export function useCascaderHasActions(): boolean {
	const { actions } = useCascaderActions();
	return actions.length > 0;
}

export { CascaderAction, CascaderFooter, CascaderSubmenu, CascaderSubmenuContent, CascaderSubmenuTrigger };
