"use client";

// The headless command list behind `components/ui/command.tsx` and the ⌘K
// palette: a search box (`role="combobox"`) that drives a `listbox` of
// options, filtered as you type, navigated with the arrow keys and chosen with
// Enter or a click. No Radix — plain React on the WAI-ARIA
// combobox pattern; the input keeps focus and `aria-activedescendant` points at
// the highlighted option. State lives in one small store per list
// (lib/ui/command/command-store.ts), so typing re-renders only the rows that
// appear or disappear. The list keeps its authored order while filtering.
//
// Import it as a namespace: `import * as CommandPrimitive from "@workspace/ui/components/command-primitive"`.

import * as React from "react";

import { defaultCommandFilter, type CommandFilter } from "@workspace/ui/lib/command/command-filter";
import { createCommandStore, type CommandStore } from "@workspace/ui/lib/command/command-store";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";

/** Dispatched on the highlighted option when Enter is pressed; the option runs its `onSelect`. */
const ITEM_SELECT_EVENT = "command-item-select";
const ITEM_SELECTOR = "[data-command-item]:not([data-disabled])";
const KEYWORD_SEPARATOR = "\u0000";

interface CommandContextValue {
	readonly store: CommandStore;
	readonly listId: string;
	readonly inputId: string;
	readonly labelId: string | undefined;
	readonly label: string | undefined;
	readonly select: (value: string) => void;
	/** The list's keyboard (arrows, Home / End, Enter), run by the input — focus never leaves it. */
	readonly handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
	readonly disablePointerSelection: boolean;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);
const GroupContext = React.createContext<string | undefined>(undefined);

function useCommandContext(part: string): CommandContextValue {
	const context = React.useContext(CommandContext);
	if (context === null) {
		throw new Error(`<${part}> must be rendered inside <CommandPrimitive.Root>.`);
	}
	return context;
}

function enabledItems(root: HTMLElement | null): readonly HTMLElement[] {
	return root === null ? [] : Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

function itemValue(element: HTMLElement): string {
	return element.getAttribute("data-value") ?? "";
}

function findItem(root: HTMLElement | null, value: string): HTMLElement | undefined {
	return enabledItems(root).find((element: HTMLElement): boolean => itemValue(element) === value);
}

// ── Root ────────────────────────────────────────────────────────────────────

export interface RootProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onSelect" | "defaultValue" | "onChange" | "value"> {
	/** The accessible name of the list (rendered as a visually hidden `<label>` for the input). */
	readonly label?: string | undefined;
	/** `false` leaves filtering to you — every option stays visible whatever is typed. Default `true`. */
	readonly shouldFilter?: boolean | undefined;
	/** Replaces the default matcher (case-insensitive over the value and keywords). */
	readonly filter?: CommandFilter | undefined;
	/** The highlighted option's value (controlled). */
	readonly value?: string | undefined;
	/** The item highlighted first, uncontrolled. */
	readonly defaultValue?: string | undefined;
	/** Fires as the highlighted item changes. */
	readonly onValueChange?: ((value: string) => void) | undefined;
	/** Arrow keys wrap from the last option to the first and back. */
	readonly loop?: boolean | undefined;
	/** Moving the pointer over an option does not highlight it. */
	readonly disablePointerSelection?: boolean | undefined;
	/** Ctrl+N / Ctrl+J move down, Ctrl+P / Ctrl+K move up. Default `true`. */
	readonly vimBindings?: boolean | undefined;
}

export const Root = React.forwardRef<HTMLDivElement, RootProps>(function CommandRoot(
	{
		label,
		shouldFilter = true,
		filter = defaultCommandFilter,
		value,
		defaultValue,
		onValueChange,
		loop = false,
		disablePointerSelection = false,
		vimBindings = true,
		children,
		...props
	},
	ref,
): React.JSX.Element {
	const [store] = React.useState((): CommandStore => createCommandStore(value ?? defaultValue ?? ""));
	const rootRef = React.useRef<HTMLDivElement>(null);
	const setRootRef = React.useMemo(() => mergeRefs(rootRef, ref), [ref]);
	const baseId = React.useId();
	const isControlled = value !== undefined;

	const onValueChangeRef = React.useRef(onValueChange);
	React.useLayoutEffect((): void => {
		onValueChangeRef.current = onValueChange;
	}, [onValueChange]);

	React.useLayoutEffect((): void => {
		store.setOptions({ shouldFilter, filter });
	}, [store, shouldFilter, filter]);

	React.useLayoutEffect((): void => {
		if (value !== undefined) {
			store.setSelectedValue(value);
		}
	}, [store, value]);

	const select = React.useCallback(
		(next: string): void => {
			if (!isControlled) {
				store.setSelectedValue(next);
			}
			onValueChangeRef.current?.(next);
		},
		[isControlled, store],
	);

	const search = React.useSyncExternalStore(store.subscribe, store.getSearch, store.getSearch);
	const version = React.useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
	const selectedValue = React.useSyncExternalStore(store.subscribe, store.getSelectedValue, store.getSelectedValue);

	// A new search, or a highlight that is no longer listed, moves the highlight to the first option.
	const previousSearch = React.useRef(search);
	React.useLayoutEffect((): void => {
		const searchChanged = previousSearch.current !== search;
		previousSearch.current = search;
		if (!searchChanged && findItem(rootRef.current, store.getSelectedValue()) !== undefined) {
			return;
		}
		const first = enabledItems(rootRef.current).at(0);
		const next = first === undefined ? "" : itemValue(first);
		if (next !== store.getSelectedValue()) {
			select(next);
		}
	}, [search, version, select, store]);

	React.useEffect((): void => {
		findItem(rootRef.current, selectedValue)?.scrollIntoView({ block: "nearest" });
	}, [selectedValue]);

	const move = React.useCallback(
		(step: number, edge?: "first" | "last"): void => {
			const items = enabledItems(rootRef.current);
			if (items.length === 0) {
				return;
			}
			const lastIndex = items.length - 1;
			const currentIndex = items.findIndex((element: HTMLElement): boolean => itemValue(element) === store.getSelectedValue());
			let nextIndex: number;
			if (edge === "first") {
				nextIndex = 0;
			} else if (edge === "last") {
				nextIndex = lastIndex;
			} else if (currentIndex === -1) {
				nextIndex = step > 0 ? 0 : lastIndex;
			} else if (loop) {
				nextIndex = (currentIndex + step + items.length) % items.length;
			} else {
				nextIndex = Math.min(Math.max(currentIndex + step, 0), lastIndex);
			}
			const target = items.at(nextIndex);
			if (target !== undefined) {
				select(itemValue(target));
			}
		},
		[loop, select, store],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			if (event.defaultPrevented || event.nativeEvent.isComposing) {
				return;
			}
			const vimKey = vimBindings && event.ctrlKey && !event.metaKey && !event.altKey ? event.key.toLowerCase() : "";
			if (event.key === "ArrowDown" || vimKey === "n" || vimKey === "j") {
				event.preventDefault();
				move(1);
			} else if (event.key === "ArrowUp" || vimKey === "p" || vimKey === "k") {
				event.preventDefault();
				move(-1);
			} else if (event.key === "Home") {
				event.preventDefault();
				move(0, "first");
			} else if (event.key === "End") {
				event.preventDefault();
				move(0, "last");
			} else if (event.key === "Enter") {
				const target = findItem(rootRef.current, store.getSelectedValue());
				if (target !== undefined) {
					event.preventDefault();
					target.dispatchEvent(new Event(ITEM_SELECT_EVENT));
				}
			}
		},
		[move, store, vimBindings],
	);

	const labelId = label === undefined ? undefined : `${baseId}-label`;
	const context = React.useMemo(
		(): CommandContextValue => ({ store, listId: `${baseId}-list`, inputId: `${baseId}-input`, labelId, label, select, handleKeyDown, disablePointerSelection }),
		[baseId, disablePointerSelection, handleKeyDown, label, labelId, select, store],
	);

	return (
		<div ref={setRootRef} data-command-root="" {...props}>
			{label === undefined ? null : (
				<label id={labelId} htmlFor={context.inputId} className="sr-only">
					{label}
				</label>
			)}
			<CommandContext.Provider value={context}>{children}</CommandContext.Provider>
		</div>
	);
});

// ── Input ───────────────────────────────────────────────────────────────────

export interface InputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "value" | "type"> {
	/** The search text (controlled). */
	readonly value?: string | undefined;
	/** Fires as the search text changes. */
	readonly onValueChange?: ((search: string) => void) | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function CommandInput(
	{ value, onValueChange, onChange, onKeyDown, "aria-label": ariaLabel, ...props },
	ref,
): React.JSX.Element {
	const { store, listId, inputId, labelId, handleKeyDown } = useCommandContext("CommandPrimitive.Input");
	const search = React.useSyncExternalStore(store.subscribe, store.getSearch, store.getSearch);
	const activeId = React.useSyncExternalStore(
		store.subscribe,
		(): string | undefined => store.getItemIdByValue(store.getSelectedValue()),
		(): string | undefined => undefined,
	);

	React.useLayoutEffect((): void => {
		if (value !== undefined) {
			store.setSearch(value);
		}
	}, [store, value]);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.(event);
			if (value === undefined) {
				store.setSearch(event.target.value);
			}
			onValueChange?.(event.target.value);
		},
		[onChange, onValueChange, store, value],
	);

	const handleInputKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			onKeyDown?.(event);
			handleKeyDown(event);
		},
		[handleKeyDown, onKeyDown],
	);

	return (
		<input
			ref={ref}
			id={inputId}
			data-command-input=""
			autoComplete="off"
			autoCorrect="off"
			spellCheck={false}
			// The list's label names the input too, unless the input is given its own name.
			aria-label={ariaLabel}
			aria-labelledby={ariaLabel === undefined ? labelId : undefined}
			{...props}
			type="text"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded="true"
			aria-controls={listId}
			aria-activedescendant={activeId}
			value={value ?? search}
			onChange={handleChange}
			onKeyDown={handleInputKeyDown}
		/>
	);
});

// ── List ────────────────────────────────────────────────────────────────────

export type ListProps = React.ComponentPropsWithoutRef<"div">;

export const List = React.forwardRef<HTMLDivElement, ListProps>(function CommandList({ children, ...props }, ref): React.JSX.Element {
	const { listId, label } = useCommandContext("CommandPrimitive.List");
	return (
		<div ref={ref} id={listId} data-command-list="" role="listbox" aria-label={label} tabIndex={-1} {...props}>
			{children}
		</div>
	);
});

// ── Empty ───────────────────────────────────────────────────────────────────

export type EmptyProps = React.ComponentPropsWithoutRef<"div">;

/** Renders only when no option matches the search. */
export const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(function CommandEmpty(props, ref): React.JSX.Element | null {
	const { store } = useCommandContext("CommandPrimitive.Empty");
	const visibleCount = React.useSyncExternalStore(store.subscribe, store.getVisibleCount, store.getVisibleCount);
	return visibleCount === 0 ? <div ref={ref} data-command-empty="" role="presentation" {...props} /> : null;
});

// ── Group ───────────────────────────────────────────────────────────────────

export interface GroupProps extends React.ComponentPropsWithoutRef<"div"> {
	/** The group's visible heading; it also names the group for assistive technology. */
	readonly heading?: React.ReactNode;
	/** Identifies the group (used as its key when filtering). */
	readonly value?: string | undefined;
	/** Shown even when none of its options match. */
	readonly forceMount?: boolean | undefined;
}

/** Hidden (never unmounted, so its options stay registered) while none of its options match. */
export const Group = React.forwardRef<HTMLDivElement, GroupProps>(function CommandGroup({ heading, value, forceMount = false, children, ...props }, ref): React.JSX.Element {
	const { store } = useCommandContext("CommandPrimitive.Group");
	const groupId = React.useId();
	const headingId = `${groupId}-heading`;
	const hasHeading = heading !== undefined && heading !== null;
	const visible = React.useSyncExternalStore(
		store.subscribe,
		(): boolean => forceMount || store.isGroupVisible(groupId),
		(): boolean => true,
	);
	return (
		<div ref={ref} data-command-group="" role="presentation" hidden={!visible} data-value={value} {...props}>
			{hasHeading ? (
				<div data-command-group-heading="" data-slot="command-group-heading" aria-hidden="true" id={headingId}>
					{heading}
				</div>
			) : null}
			<div data-command-group-items="" role="group" aria-labelledby={hasHeading ? headingId : undefined}>
				<GroupContext.Provider value={groupId}>{children}</GroupContext.Provider>
			</div>
		</div>
	);
});

// ── Separator ───────────────────────────────────────────────────────────────

export interface SeparatorProps extends React.ComponentPropsWithoutRef<"div"> {
	/** Keep it while searching (by default it hides once there is a search). */
	readonly alwaysRender?: boolean | undefined;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(function CommandSeparator({ alwaysRender = false, ...props }, ref): React.JSX.Element | null {
	const { store } = useCommandContext("CommandPrimitive.Separator");
	const searching = React.useSyncExternalStore(
		store.subscribe,
		(): boolean => store.getSearch() !== "",
		(): boolean => false,
	);
	return !alwaysRender && searching ? null : <div ref={ref} data-command-separator="" role="separator" {...props} />;
});

// ── Item ────────────────────────────────────────────────────────────────────

export interface ItemProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onSelect" | "value"> {
	/** What the option is matched and selected by; defaults to its text. */
	readonly value?: string | undefined;
	/** Extra words that match it ("dms" for Direct messages). */
	readonly keywords?: readonly string[] | undefined;
	/** Shows the item but skips it for the highlight and Enter. */
	readonly disabled?: boolean | undefined;
	/** Shown whatever is typed. */
	readonly forceMount?: boolean | undefined;
	/** Chosen — by click, or Enter while highlighted. */
	readonly onSelect?: ((value: string) => void) | undefined;
}

export const Item = React.forwardRef<HTMLDivElement, ItemProps>(function CommandItem(
	{ value: valueProp, keywords, disabled = false, forceMount = false, onSelect, onClick, onMouseDown, onPointerMove, children, ...props },
	ref,
): React.JSX.Element | null {
	const { store, select, disablePointerSelection } = useCommandContext("CommandPrimitive.Item");
	const groupId = React.useContext(GroupContext);
	const id = React.useId();
	const ownRef = React.useRef<HTMLDivElement>(null);
	const setRef = React.useMemo(() => mergeRefs(ownRef, ref), [ref]);

	// Without a `value`, the option is known by its text — read after it renders.
	const [textValue, setTextValue] = React.useState("");
	React.useLayoutEffect((): void => {
		if (valueProp === undefined) {
			const text = ownRef.current?.textContent.trim();
			if (text !== undefined && text !== textValue) {
				setTextValue(text);
			}
		}
	}, [children, textValue, valueProp]);
	const value = valueProp?.trim() ?? textValue;

	const keywordsKey = (keywords ?? []).join(KEYWORD_SEPARATOR);
	React.useLayoutEffect((): void => {
		store.upsert(id, { value, keywords: keywordsKey === "" ? [] : keywordsKey.split(KEYWORD_SEPARATOR), groupId, alwaysVisible: forceMount });
	}, [forceMount, groupId, id, keywordsKey, store, value]);
	React.useLayoutEffect(
		(): (() => void) => (): void => {
			store.remove(id);
		},
		[id, store],
	);

	const visible = React.useSyncExternalStore(
		store.subscribe,
		(): boolean => store.isItemVisible(id),
		(): boolean => true,
	);
	const selected = React.useSyncExternalStore(
		store.subscribe,
		(): boolean => value !== "" && store.getSelectedValue() === value,
		(): boolean => false,
	);

	const runSelect = React.useEffectEvent((): void => {
		if (!disabled) {
			onSelect?.(value);
		}
	});
	React.useEffect((): (() => void) | undefined => {
		const element = ownRef.current;
		if (element === null) {
			return undefined;
		}
		const handleSelect = (): void => {
			runSelect();
		};
		element.addEventListener(ITEM_SELECT_EVENT, handleSelect);
		return (): void => {
			element.removeEventListener(ITEM_SELECT_EVENT, handleSelect);
		};
	}, [visible]);

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			onClick?.(event);
			if (!event.defaultPrevented && !disabled) {
				onSelect?.(value);
			}
		},
		[disabled, onClick, onSelect, value],
	);

	// Options are focusable only so assistive technology treats them as options: a press must leave focus in the search box.
	const handleMouseDown = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			onMouseDown?.(event);
			event.preventDefault();
		},
		[onMouseDown],
	);

	const handlePointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			onPointerMove?.(event);
			if (!disabled && !disablePointerSelection && !selected) {
				select(value);
			}
		},
		[disablePointerSelection, disabled, onPointerMove, select, selected, value],
	);

	if (!visible) {
		return null;
	}
	return (
		<div
			ref={setRef}
			id={id}
			data-command-item=""
			role="option"
			tabIndex={-1}
			aria-selected={selected}
			aria-disabled={disabled ? true : undefined}
			data-selected={selected ? "true" : undefined}
			data-disabled={disabled ? "true" : undefined}
			data-value={value}
			{...props}
			onClick={handleClick}
			onMouseDown={handleMouseDown}
			onPointerMove={handlePointerMove}>
			{children}
		</div>
	);
});
