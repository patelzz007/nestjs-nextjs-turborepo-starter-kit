"use client";

// A command list: a search input over a list of actions, filtered as the user
// types, walked with the arrow keys and run with Enter or a click. shadcn's
// `Command` API (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`,
// `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`,
// `CommandDialog`), built on Base UI's inline `Autocomplete` — the kit uses
// Base UI only. Base UI owns the keyboard, the highlight and the listbox
// semantics; this file owns the filtering, so items stay plain JSX (Base UI
// filters only an `items` array). Deliberate deviations from shadcn (cmdk):
// - Every `CommandItem` takes an explicit `value`: the text it is searched by
//   (with its `keywords`) and what `onSelect` receives. cmdk read the item's
//   rendered text, shortcut glyphs included.
// - Matching is Base UI's locale-aware "contains" (accents and case ignored),
//   not cmdk's fuzzy score, and items keep their rendered order.
// - The highlighted item carries `data-highlighted` (cmdk: `data-selected`), a
//   disabled one `data-disabled`.
// - `shouldFilter={false}` hands the filtering to the caller, who renders only
//   the matching items; `CommandEmpty` still shows whenever no item is rendered
//   and a group with no rendered item is hidden, as in cmdk.

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { InputGroup, InputGroupAddon } from "@workspace/ui/components/input-group";
import { menuItemDensityClasses } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import { SearchIcon, CheckIcon } from "lucide-react";
import * as React from "react";

/** Which items are rendered right now, and in which group: what `CommandEmpty` and `CommandGroup` show by. */
export interface CommandRegistry {
	/** Records a rendered item; returns how to forget it (on unmount, or when it stops matching). */
	readonly show: (itemId: string, groupId: string | null) => () => void;
	readonly subscribe: (listener: () => void) => () => void;
	/** How many items are rendered. */
	readonly countAll: () => number;
	/** How many items are rendered in one group. */
	readonly countIn: (groupId: string) => number;
}

export function createCommandRegistry(): CommandRegistry {
	const shown = new Map<string, string | null>();
	const listeners = new Set<() => void>();
	const notify = (): void => {
		for (const listener of listeners) {
			listener();
		}
	};
	return {
		show: (itemId: string, groupId: string | null): (() => void) => {
			shown.set(itemId, groupId);
			notify();
			return (): void => {
				shown.delete(itemId);
				notify();
			};
		},
		subscribe: (listener: () => void): (() => void) => {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		countAll: (): number => shown.size,
		countIn: (groupId: string): number => [...shown.values()].filter((group: string | null): boolean => group === groupId).length,
	};
}

/** Whether an item matches the query: its value or any keyword contains it. An empty query matches everything. */
export function commandItemMatches(contains: (text: string, query: string) => boolean, query: string, value: string, keywords: readonly string[] = []): boolean {
	const trimmed = query.trim();
	if (trimmed === "") {
		return true;
	}
	return [value, ...keywords].some((text: string): boolean => contains(text, trimmed));
}

/** What a `CommandInput` hands its `Command`: the query it controls (if any), and who hears it change. */
interface CommandInputControl {
	readonly value: string | undefined;
	readonly onValueChange: ((value: string) => void) | undefined;
}

interface CommandContextValue {
	readonly query: string;
	readonly shouldFilter: boolean;
	readonly contains: (text: string, query: string) => boolean;
	readonly registry: CommandRegistry;
	readonly label: string | undefined;
	readonly setInputControl: (control: CommandInputControl | null) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommandContext(part: string): CommandContextValue {
	const context = React.use(CommandContext);
	if (context === null) {
		throw new Error(`<${part}> must be rendered inside <Command>.`);
	}
	return context;
}

/** The group an item is rendered in, so the group can hide when none of its items is. */
const CommandGroupContext = React.createContext<string | null>(null);

function useRenderedCount(registry: CommandRegistry, groupId: string | null): number {
	const read = React.useCallback((): number => (groupId === null ? registry.countAll() : registry.countIn(groupId)), [registry, groupId]);
	return React.useSyncExternalStore(registry.subscribe, read, read);
}

export interface CommandProps extends React.ComponentProps<"div"> {
	/** `false` hands the filtering to the caller: every rendered item shows. */
	readonly shouldFilter?: boolean;
	/** The list's accessible name, when `CommandList` has no `aria-label` of its own. */
	readonly label?: string;
	/** Whether the arrow keys wrap from the last item to the first. */
	readonly loop?: boolean;
}

const Command = React.forwardRef<HTMLDivElement, CommandProps>(function Command(
	{ className, shouldFilter = true, label, loop = true, children, ...props },
	ref,
): React.JSX.Element {
	const [ownQuery, setOwnQuery] = React.useState("");
	const [inputControl, setInputControl] = React.useState<CommandInputControl | null>(null);
	const [registry] = React.useState(createCommandRegistry);
	const { contains } = AutocompletePrimitive.useFilter({ sensitivity: "base" });
	const query = inputControl?.value ?? ownQuery;

	const handleValueChange = React.useCallback(
		(next: string, details: AutocompletePrimitive.Root.ChangeEventDetails): void => {
			// Choosing an item runs it; it never writes the item into the search, and Escape leaves the search as typed.
			if (details.reason === "item-press" || details.reason === "escape-key") {
				return;
			}
			inputControl?.onValueChange?.(next);
			if (inputControl?.value === undefined) {
				setOwnQuery(next);
			}
		},
		[inputControl],
	);
	const handleOpenChange = React.useCallback((_open: boolean, details: AutocompletePrimitive.Root.OpenChangeEventDetails): void => {
		// The list is always open; Escape belongs to whatever holds the command (a dialog closes on it).
		if (details.reason === "escape-key") {
			details.allowPropagation();
		}
	}, []);
	const containsText = React.useCallback((text: string, search: string): boolean => contains(text, search), [contains]);

	const context = React.useMemo(
		(): CommandContextValue => ({ query, shouldFilter, contains: containsText, registry, label, setInputControl }),
		[query, shouldFilter, containsText, registry, label],
	);

	return (
		<CommandContext value={context}>
			<div ref={ref} data-slot="command" className={cn("flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground", className)} {...props}>
				<AutocompletePrimitive.Root
					inline
					open
					mode="none"
					autoHighlight="always"
					keepHighlight
					loopFocus={loop}
					value={query}
					onValueChange={handleValueChange}
					onOpenChange={handleOpenChange}>
					{children}
				</AutocompletePrimitive.Root>
			</div>
		</CommandContext>
	);
});

// The ref targets the dialog popup (the element the dialog actually renders);
// open/onOpenChange and the rest of the Root props pass straight through, so
// the dialog stays fully controllable by the parent.
const CommandDialog = React.forwardRef<
	HTMLDivElement,
	Omit<React.ComponentProps<typeof Dialog>, "children"> & {
		readonly title: string;
		readonly description: string;
		className?: string;
		showCloseButton?: boolean;
		children: React.ReactNode;
	}
>(function CommandDialog({ title, description, children, className, showCloseButton = false, ...props }, ref): React.JSX.Element {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent ref={ref} className={cn("overflow-hidden rounded-xl! p-0", className)} showCloseButton={showCloseButton}>
				{children}
			</DialogContent>
		</Dialog>
	);
});

export interface CommandInputProps extends Omit<AutocompletePrimitive.Input.Props, "value" | "defaultValue" | "onValueChange"> {
	/** The search, when the caller owns it. */
	readonly value?: string;
	readonly onValueChange?: (value: string) => void;
}

/**
 * The search input with no styling of its own, for a command that draws its own
 * search field (the app command palette). `CommandInput` is this in the kit's field.
 */
const CommandInputPrimitive = React.forwardRef<HTMLInputElement, CommandInputProps>(function CommandInputPrimitive(
	{ value, onValueChange, ...props },
	ref,
): React.JSX.Element {
	const { setInputControl } = useCommandContext("CommandInput");
	// The search lives on the command (its root filters by it); a controlled input hands it its value and its listener.
	React.useLayoutEffect((): (() => void) => {
		setInputControl({ value, onValueChange });
		return (): void => {
			setInputControl(null);
		};
	}, [setInputControl, value, onValueChange]);
	return <AutocompletePrimitive.Input ref={ref} data-slot="command-input" {...props} />;
});

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(function CommandInput({ className, ...props }, ref): React.JSX.Element {
	return (
		<div data-slot="command-input-wrapper" className="p-1 pb-0">
			<InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:ps-2!">
				<CommandInputPrimitive ref={ref} className={cn("w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
				<InputGroupAddon>
					<SearchIcon className="size-4 shrink-0 opacity-50" />
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
});

const CommandList = React.forwardRef<HTMLDivElement, AutocompletePrimitive.List.Props>(function CommandList({ className, ...props }, ref): React.JSX.Element {
	const { label } = useCommandContext("CommandList");
	return (
		<AutocompletePrimitive.List
			ref={ref}
			data-slot="command-list"
			aria-label={label}
			className={cn("no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none", className)}
			{...props}
		/>
	);
});

/** Shows while no item is rendered: nothing matches the search, or the caller rendered none. */
const CommandEmpty = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CommandEmpty({ className, ...props }, ref): React.JSX.Element | null {
	const { registry } = useCommandContext("CommandEmpty");
	const rendered = useRenderedCount(registry, null);
	if (rendered > 0) {
		return null;
	}
	return <div ref={ref} data-slot="command-empty" className={cn("py-6 text-center text-sm", className)} {...props} />;
});

export interface CommandGroupProps extends AutocompletePrimitive.Group.Props {
	/** The group's visible name, read out as the name of its items. */
	readonly heading?: React.ReactNode;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(function CommandGroup({ className, heading, children, ...props }, ref): React.JSX.Element {
	const { registry } = useCommandContext("CommandGroup");
	const groupId = React.useId();
	const rendered = useRenderedCount(registry, groupId);
	return (
		<CommandGroupContext value={groupId}>
			<AutocompletePrimitive.Group
				ref={ref}
				data-slot="command-group"
				// Kept mounted while empty, so its items can report themselves the moment they match again.
				hidden={rendered === 0}
				className={cn("overflow-hidden p-1 text-foreground", className)}
				{...props}>
				{heading === undefined ? null : (
					<AutocompletePrimitive.GroupLabel data-slot="command-group-heading" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
						{heading}
					</AutocompletePrimitive.GroupLabel>
				)}
				{children}
			</AutocompletePrimitive.Group>
		</CommandGroupContext>
	);
});

const CommandSeparator = React.forwardRef<HTMLDivElement, AutocompletePrimitive.Separator.Props>(function CommandSeparator({ className, ...props }, ref): React.JSX.Element {
	return <AutocompletePrimitive.Separator ref={ref} data-slot="command-separator" className={cn("-mx-1 h-px w-auto bg-border", className)} {...props} />;
});

// `onSelect` replaces the DOM's text-selection event, which an item never needs.
export interface CommandItemProps extends Omit<AutocompletePrimitive.Item.Props, "value" | "onSelect"> {
	/** What the item is searched by, and what `onSelect` receives. */
	readonly value: string;
	/** More words the item is found by. */
	readonly keywords?: readonly string[];
	/** Runs the item: a click, or Enter while it is highlighted. */
	readonly onSelect?: (value: string) => void;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(function CommandItem(
	{ className, children, value, keywords, onSelect, onClick, disabled = false, ...props },
	ref,
): React.JSX.Element | null {
	const { query, shouldFilter, contains, registry } = useCommandContext("CommandItem");
	const groupId = React.use(CommandGroupContext);
	const itemId = React.useId();
	const matches = !shouldFilter || commandItemMatches(contains, query, value, keywords);

	React.useLayoutEffect((): (() => void) | undefined => (matches ? registry.show(itemId, groupId) : undefined), [matches, registry, itemId, groupId]);

	const handleClick = React.useCallback(
		(event: Parameters<NonNullable<AutocompletePrimitive.Item.Props["onClick"]>>[0]): void => {
			onClick?.(event);
			if (!disabled) {
				onSelect?.(value);
			}
		},
		[onClick, onSelect, disabled, value],
	);

	if (!matches) {
		return null;
	}
	return (
		<AutocompletePrimitive.Item
			ref={ref}
			value={value}
			disabled={disabled}
			onClick={handleClick}
			data-slot="command-item"
			className={cn(
				"group/command-item relative flex cursor-default items-center gap-2 rounded-sm text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-highlighted:**:[svg]:text-foreground",
				menuItemDensityClasses,
				className,
			)}
			{...props}>
			{children}
			<CheckIcon className="ms-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
		</AutocompletePrimitive.Item>
	);
});

const CommandShortcut = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function CommandShortcut({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="command-shortcut"
			className={cn("ms-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/command-item:text-foreground", className)}
			{...props}
		/>
	);
});

export { Command, CommandDialog, CommandInput, CommandInputPrimitive, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator };
