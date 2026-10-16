"use client";

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
	EMOJI_FONT_CLASS,
	EMOJI_PICKER_CLEAR_ICON,
	EMOJI_PICKER_SEARCH_ICON,
	EMOJI_PICKER_TRIGGER_ICON,
	EmojiGlyph,
	EmojiPickerContext,
	EmojiPickerSurfaceContext,
	emojiPickerOptionId,
	useEmojiPickerContext,
	type EmojiPickerContextValue,
} from "@workspace/ui/components/emoji-picker-context";
import { EmojiPickerList } from "@workspace/ui/components/emoji-picker-list";
import { EMOJI_PICKER_RECENT_SECTION, isTouchScreen, useEmojiPickerController, type EmojiPickerProps } from "@workspace/ui/components/emoji-picker-state";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import type { InputProps } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import {
	EMOJI_PICKER_SKIN_TONES,
	type EmojiPickerData,
	type EmojiPickerDataStatus,
	type EmojiPickerEmoji,
	type EmojiPickerSkinTone as SkinTone,
} from "@workspace/ui/lib/emoji-picker/data";
import { EMOJI_PICKER_PADDING_PX, EMOJI_PICKER_VISIBLE_ROWS, type EmojiPickerSection } from "@workspace/ui/lib/emoji-picker/layout";
import { getEmojiValue } from "@workspace/ui/lib/emoji-picker/search";
import { parseStoredTone } from "@workspace/ui/lib/emoji-picker/storage";
import type { BaseUIEvent } from "@base-ui/react/types";
import { cva } from "class-variance-authority";
import * as React from "react";

/** 0 is the default yellow; 1 to 5 run from light to dark. Shares its name with the `EmojiPickerSkinTone` part, as in reui. */
export type EmojiPickerSkinTone = SkinTone;

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

/**
 * An emoji picker: search, shortcodes, skin tones, frequently used and custom
 * emoji, a category bar and a virtualized grid. Without children it renders a
 * trigger and a popover (the ref reaches the trigger); with children it renders
 * only them — an `EmojiPickerPanel` alone makes an inline picker.
 */
const EmojiPicker = React.forwardRef<HTMLButtonElement, EmojiPickerProps>(function EmojiPicker(props, ref): React.JSX.Element {
	const { context, field, setOpen } = useEmojiPickerController(props, ref);
	const { className, children, onFocus, onBlur } = props;
	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			setOpen(next);
		},
		[setOpen],
	);
	return (
		<EmojiPickerContext.Provider value={context}>
			<Popover open={context.open} onOpenChange={handleOpenChange}>
				{children === undefined ? (
					<>
						<EmojiPickerTrigger className={className} onFocus={onFocus} onBlur={onBlur} />
						<EmojiPickerContent />
					</>
				) : (
					children
				)}
			</Popover>
			{field}
		</EmojiPickerContext.Provider>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Hook API                                  */
/* -------------------------------------------------------------------------- */

export interface EmojiPickerApi {
	readonly data: EmojiPickerData | null;
	readonly status: EmojiPickerDataStatus;
	readonly retry: () => void;
	/** The emoji the grid can show: custom ones, then the data after version, flag and `filter` checks. */
	readonly emojis: readonly EmojiPickerEmoji[];
	readonly query: string;
	readonly setQuery: (query: string) => void;
	readonly skinTone: SkinTone;
	readonly setSkinTone: (tone: SkinTone) => void;
	/** The highlighted emoji: hovered, or reached with the arrow keys. */
	readonly activeEmoji: EmojiPickerEmoji | null;
	/** Single mode: the value, or `null`. Multiple mode: the first value. */
	readonly value: string | null;
	readonly values: readonly string[];
	/** The recent section's emoji, in display order. */
	readonly recent: readonly EmojiPickerEmoji[];
	/** Same as clicking the emoji's cell. */
	readonly select: (emoji: EmojiPickerEmoji) => void;
	/** Empties the value. */
	readonly clear: () => void;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
}

/** The picker's state and actions, inside an `EmojiPicker`. */
function useEmojiPicker(): EmojiPickerApi {
	const context = useEmojiPickerContext("useEmojiPicker");
	const [value = null] = context.values;
	return {
		data: context.data,
		status: context.status,
		retry: context.retry,
		emojis: context.emojis,
		query: context.query,
		setQuery: context.setQuery,
		skinTone: context.skinTone,
		setSkinTone: context.setSkinTone,
		activeEmoji: context.activeEmoji,
		value,
		values: context.values,
		recent: context.tabs.find((section: EmojiPickerSection): boolean => section.id === EMOJI_PICKER_RECENT_SECTION)?.emojis ?? [],
		select: (emoji: EmojiPickerEmoji): void => {
			context.pick(emoji);
		},
		clear: context.clear,
		open: context.open,
		setOpen: context.setOpen,
	};
}

/* -------------------------------------------------------------------------- */
/*                                    Value                                   */
/* -------------------------------------------------------------------------- */

export type EmojiPickerValueProps = Omit<React.ComponentProps<"span">, "children"> & {
	/** Defaults to the picker's value. */
	readonly value?: string | null | undefined;
	readonly placeholder?: React.ReactNode;
};

/** An emoji value drawn like the grid draws it, custom images included. For triggers and readouts. */
const EmojiPickerValue = React.forwardRef<HTMLSpanElement, EmojiPickerValueProps>(function EmojiPickerValue(
	{ value: valueProp, placeholder, className, ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerValue");
	const [first = null] = context.values;
	const value = valueProp === undefined ? first : valueProp;
	const hasValue = value !== null && value !== "";
	return (
		<span
			ref={ref}
			data-slot="emoji-picker-value"
			data-placeholder={hasValue ? undefined : ""}
			className={cn("inline-flex items-center justify-center", className)}
			{...props}>
			{hasValue ? <EmojiGlyph emoji={context.findByValue(value)} value={value} /> : placeholder}
		</span>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Trigger                                  */
/* -------------------------------------------------------------------------- */

export type EmojiPickerTriggerProps = Omit<React.ComponentPropsWithoutRef<typeof Button>, "type">;

function triggerName(context: EmojiPickerContextValue, value: string | null): string | undefined {
	if (context.labelledBy !== undefined) {
		return undefined;
	}
	const name = context.label ?? context.labels.trigger;
	if (value === null) {
		return name;
	}
	const emoji = context.findByValue(value);
	/* Before the data loads, the glyph itself stands in for its name: screen
	   readers speak an emoji's name. */
	return `${name}: ${emoji === undefined ? value : context.labels.formatLabel(emoji.label)}`;
}

/**
 * The Button that opens the picker: the value, or a smiley. Hovering or
 * focusing it starts the data fetch, so the grid is ready on open.
 */
const EmojiPickerTrigger = React.forwardRef<HTMLButtonElement, EmojiPickerTriggerProps>(function EmojiPickerTrigger(
	{ className, variant = "outline", size = "icon", children, onPointerEnter, onFocus, ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerTrigger");
	const { requestData, registerFocusTarget, triggerRef } = context;
	const [first = null] = context.values;
	const value = context.multiple || first === "" ? null : first;
	const mergedRef = React.useMemo((): React.RefCallback<HTMLButtonElement> => mergeRefs(ref, triggerRef, registerFocusTarget), [ref, triggerRef, registerFocusTarget]);

	const handlePointerEnter = React.useCallback(
		(event: BaseUIEvent<React.PointerEvent<HTMLButtonElement>>): void => {
			onPointerEnter?.(event);
			requestData();
		},
		[onPointerEnter, requestData],
	);
	const handleFocus = React.useCallback(
		(event: BaseUIEvent<React.FocusEvent<HTMLButtonElement>>): void => {
			onFocus?.(event);
			requestData();
		},
		[onFocus, requestData],
	);

	const content = children ?? (value === null ? EMOJI_PICKER_TRIGGER_ICON : <EmojiPickerValue />);

	return (
		<PopoverTrigger
			ref={mergedRef}
			id={context.id}
			render={
				<Button
					type="button"
					variant={variant}
					size={size}
					disabled={context.disabled}
					aria-label={triggerName(context, value)}
					aria-labelledby={context.labelledBy}
					aria-describedby={context.describedBy}
					aria-invalid={context.invalid ? true : undefined}
					data-invalid={context.invalid ? "" : undefined}
					{...props}
					onPointerEnter={handlePointerEnter}
					onFocus={handleFocus}
					data-slot="emoji-picker-trigger"
					data-placeholder={value === null ? "" : undefined}
					/* The value glyph reads larger than label text; a className size wins. */
					className={cn(value !== null && children === undefined ? "text-lg" : undefined, className)}
				/>
			}>
			{content}
		</PopoverTrigger>
	);
});

/* -------------------------------------------------------------------------- */
/*                                Content, Panel                              */
/* -------------------------------------------------------------------------- */

const TABBABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export type EmojiPickerContentProps = React.ComponentProps<typeof PopoverContent> & {
	/** Where focus goes on close, such as a composer's textarea. Defaults to the trigger. */
	readonly returnFocus?: React.RefObject<HTMLElement | null> | undefined;
};

/**
 * The popover. It wraps its children in an `EmojiPickerPanel`, so it takes the
 * same parts; with none it renders the default layout. Tab cycles inside it.
 */
const EmojiPickerContent = React.forwardRef<HTMLDivElement, EmojiPickerContentProps>(function EmojiPickerContent(
	{ className, align = "start", returnFocus, onKeyDown, onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerContent");
	const { searchRef, listRef } = context;
	/* The search, except on a touch screen; else the grid; else the popup. */
	const initialFocus = React.useCallback((): HTMLElement | boolean => (isTouchScreen() ? null : searchRef.current) ?? listRef.current ?? true, [listRef, searchRef]);

	/* React bubbles a portaled click through the component tree, so a trigger
	   inside an InputGroupAddon would see every click in here and move focus to
	   the group's input, out of the search. */
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLDivElement>>): void => {
			onClick?.(event);
			event.stopPropagation();
		},
		[onClick],
	);

	const handleKeyDown = React.useCallback(
		(event: BaseUIEvent<React.KeyboardEvent<HTMLDivElement>>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			/* tabIndex, not the selector alone: the category tabs rove, so all but
			   one are buttons outside the tab order. */
			const items = [...event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE)].filter((item: HTMLElement): boolean => item.tabIndex >= 0);
			const activeElement = event.currentTarget.ownerDocument.activeElement;
			const [firstItem] = items;
			const lastItem = items.at(-1);
			if (!event.shiftKey && activeElement === lastItem) {
				event.preventDefault();
				firstItem?.focus();
			} else if (event.shiftKey && activeElement === firstItem) {
				event.preventDefault();
				lastItem?.focus();
			}
		},
		[onKeyDown],
	);

	return (
		<PopoverContent
			ref={ref}
			align={align}
			aria-labelledby={context.labelledBy}
			aria-label={context.labelledBy === undefined ? (context.label ?? context.labels.panel) : undefined}
			className={cn("max-h-(--available-height) w-auto gap-0 overflow-hidden p-0", className)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			initialFocus={initialFocus}
			finalFocus={returnFocus ?? true}
			{...props}>
			<EmojiPickerSurfaceContext.Provider value="popup">
				<EmojiPickerPanel>{children}</EmojiPickerPanel>
			</EmojiPickerSurfaceContext.Provider>
		</PopoverContent>
	);
});

const emojiPickerPanelVariants = cva(
	/* Sized from the columns: the list hides its scrollbar, so nothing else takes width. */
	"flex min-h-0 w-[calc(var(--emoji-picker-columns)*var(--emoji-picker-cell)+var(--emoji-picker-gutter)*2)] max-w-full min-w-0 flex-col data-[columns=auto]:w-full",
	{
		variants: {
			/* The sticky headers paint the surface they sit on: an inline panel
			   belongs in a Card, a popup is the popover. */
			surface: {
				inline: "[--emoji-picker-surface:var(--color-card)]",
				popup: "[--emoji-picker-surface:var(--color-popover)]",
			},
			state: {
				default: "",
				loading: "",
				disabled: "pointer-events-none opacity-50",
				error: "",
			},
		},
		defaultVariants: {
			surface: "inline",
			state: "default",
		},
	},
);

export type EmojiPickerPanelProps = React.ComponentProps<"div">;

/**
 * The picker surface. Inline, put it straight inside an `EmojiPicker` with no
 * trigger. Without children it renders the search, the tabs, the grid and a
 * footer with the preview and the skin tone; with children, only those parts.
 */
const EmojiPickerPanel = React.forwardRef<HTMLDivElement, EmojiPickerPanelProps>(function EmojiPickerPanel({ className, style, children, ...props }, ref): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerPanel");
	const surface = React.useContext(EmojiPickerSurfaceContext);
	const isInline = surface === "inline";
	const { requestData, columnCount } = context;
	const { cell, emoji, header, gutter } = context.size;

	React.useEffect((): void => {
		requestData();
	}, [requestData]);

	const panelStyle = React.useMemo(
		(): React.CSSProperties => ({
			...({
				"--emoji-picker-cell": `${String(cell)}px`,
				"--emoji-picker-emoji": `${String(emoji)}px`,
				"--emoji-picker-header": `${String(header)}px`,
				"--emoji-picker-gutter": `${String(gutter)}px`,
				"--emoji-picker-padding": `${String(EMOJI_PICKER_PADDING_PX)}px`,
				"--emoji-picker-columns": String(columnCount),
				"--emoji-picker-list-height": `${String(header + EMOJI_PICKER_VISIBLE_ROWS * cell + gutter)}px`,
			} satisfies React.CSSProperties & Record<string, string>),
			...style,
		}),
		[cell, emoji, header, gutter, columnCount, style],
	);

	return (
		<div
			ref={ref}
			role={isInline ? "group" : undefined}
			aria-labelledby={isInline ? context.labelledBy : undefined}
			aria-label={isInline && context.labelledBy === undefined ? (context.label ?? context.labels.panel) : undefined}
			data-slot="emoji-picker-panel"
			data-columns={context.columns === "auto" ? "auto" : undefined}
			data-disabled={context.disabled ? "" : undefined}
			data-state={context.fieldState}
			style={panelStyle}
			className={cn(emojiPickerPanelVariants({ surface, state: context.fieldState }), className)}
			{...props}>
			{children ?? (
				<>
					<EmojiPickerHeader>
						<EmojiPickerSearch />
					</EmojiPickerHeader>
					<EmojiPickerCategories />
					<EmojiPickerList />
					<EmojiPickerFooter>
						<EmojiPickerPreview />
						<EmojiPickerSkinTone />
					</EmojiPickerFooter>
				</>
			)}
		</div>
	);
});

export type EmojiPickerHeaderProps = React.ComponentProps<"div">;

/** The row above the grid, for the search and anything beside it. */
const EmojiPickerHeader = React.forwardRef<HTMLDivElement, EmojiPickerHeaderProps>(function EmojiPickerHeader({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="emoji-picker-header"
			className={cn("flex items-center gap-2 px-(--emoji-picker-padding) pt-(--emoji-picker-padding) pb-2", className)}
			{...props}
		/>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

export type EmojiPickerSearchProps = Omit<InputProps, "value" | "defaultValue">;

/**
 * The search field, an InputGroup. Focus stays here while the arrow keys move
 * through the grid (a combobox over the listbox); Enter picks the highlighted
 * emoji.
 */
const EmojiPickerSearch = React.forwardRef<HTMLInputElement, EmojiPickerSearchProps>(function EmojiPickerSearch(
	{ className, placeholder, onChange, onKeyDown, onFocus, onBlur, ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerSearch");
	const { searchRef, labels } = context;
	const activeId = context.activePosition === undefined ? undefined : emojiPickerOptionId(context.listId, context.activePosition);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLInputElement> => mergeRefs(searchRef, ref), [searchRef, ref]);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.(event);
			context.setQuery(event.target.value);
		},
		[context, onChange],
	);
	const handleFocus = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>): void => {
			onFocus?.(event);
			context.setFocused(true);
		},
		[context, onFocus],
	);
	const handleBlur = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>): void => {
			onBlur?.(event);
			context.setFocused(false);
		},
		[context, onBlur],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented) {
				return;
			}
			/* In a popover Escape closes it; inline it clears the search. */
			if (event.key === "Escape" && context.query !== "" && !context.open) {
				event.preventDefault();
				context.setQuery("");
				return;
			}
			context.navigate(event, true);
		},
		[context, onKeyDown],
	);
	const handleClear = React.useCallback((): void => {
		context.setQuery("");
		searchRef.current?.focus();
	}, [context, searchRef]);

	return (
		<InputGroup data-slot="emoji-picker-search" className={cn("flex-1", className)}>
			<InputGroupAddon>{EMOJI_PICKER_SEARCH_ICON}</InputGroupAddon>
			<InputGroupInput
				type="text"
				role="combobox"
				aria-expanded="true"
				aria-controls={context.listId}
				aria-activedescendant={activeId}
				aria-autocomplete="list"
				aria-label={labels.search}
				placeholder={placeholder ?? labels.search}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				enterKeyHint="search"
				disabled={context.disabled}
				value={context.query}
				onChange={handleChange}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				{...props}
				ref={mergedRef}
			/>
			{context.query === "" ? null : (
				<InputGroupAddon align="inline-end">
					<InputGroupButton type="button" size="icon-xs" aria-label={labels.clearSearch} data-slot="emoji-picker-search-clear" onClick={handleClear}>
						{EMOJI_PICKER_CLEAR_ICON}
					</InputGroupButton>
				</InputGroupAddon>
			)}
		</InputGroup>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Skin tone                                 */
/* -------------------------------------------------------------------------- */

/** ✋ and the five Fitzpatrick modifiers, default first. */
const HAND = "✋";
const TONE_MODIFIERS: readonly [string, string, string, string, string, string] = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];

function ToneGlyph({ tone }: { readonly tone: SkinTone }): React.JSX.Element {
	return (
		<span aria-hidden="true" className={cn(EMOJI_FONT_CLASS, "text-base")}>
			{HAND + TONE_MODIFIERS[tone]}
		</span>
	);
}

export type EmojiPickerSkinToneProps = Omit<React.ComponentPropsWithoutRef<typeof Button>, "type">;

/**
 * A Button with a hand in the current tone that opens the six tones in a
 * DropdownMenu. The choice applies to every emoji that takes a tone and is
 * remembered under `skinToneStorageKey`. Ghost at `icon-sm` for the footer by
 * default; beside the search, `outline` at `icon` matches its height.
 */
const EmojiPickerSkinTone = React.forwardRef<HTMLButtonElement, EmojiPickerSkinToneProps>(function EmojiPickerSkinTone(
	{ variant = "ghost", size = "icon-sm", ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerSkinTone");
	const { labels, setSkinTone } = context;
	const tone = context.skinTone;
	const triggerNode = React.useRef<HTMLButtonElement | null>(null);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLButtonElement> => mergeRefs(triggerNode, ref), [ref]);

	/* Base UI leaves focus on the page after a pointer pick, which inside the
	   popover strands the keyboard. The popup unmounts just after this fires,
	   so the check waits a frame. */
	const handleOpenChangeComplete = React.useCallback((open: boolean): void => {
		if (open) {
			return;
		}
		requestAnimationFrame((): void => {
			const node = triggerNode.current;
			const doc = node?.ownerDocument;
			if (doc !== undefined && (doc.activeElement === null || doc.activeElement === doc.body)) {
				node?.focus();
			}
		});
	}, []);

	const handleValueChange = React.useCallback(
		(next: string): void => {
			const parsed = parseStoredTone(next);
			if (parsed !== null) {
				setSkinTone(parsed);
			}
		},
		[setSkinTone],
	);

	return (
		<DropdownMenu onOpenChangeComplete={handleOpenChangeComplete}>
			<DropdownMenuTrigger
				ref={mergedRef}
				render={
					<Button
						type="button"
						variant={variant}
						size={size}
						disabled={context.disabled}
						aria-label={`${labels.skinTone}: ${labels.skinTones[tone]}`}
						data-slot="emoji-picker-skin-tone"
						{...props}
					/>
				}>
				<ToneGlyph tone={tone} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{labels.skinTone}</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={String(tone)} onValueChange={handleValueChange}>
						{EMOJI_PICKER_SKIN_TONES.map((option: SkinTone): React.JSX.Element => (
							<DropdownMenuRadioItem key={option} value={String(option)} closeOnClick>
								<ToneGlyph tone={option} />
								{labels.skinTones[option]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

/* -------------------------------------------------------------------------- */
/*                                 Categories                                 */
/* -------------------------------------------------------------------------- */

/* The triggers share the row evenly, so any number of categories fits; a
   trigger's own padding would overflow a row of 11. */
const TAB_CLASS = "max-w-9 min-w-0 px-0";

interface EmojiPickerCategoryTabProps {
	readonly tab: EmojiPickerSection;
	readonly isDisabled: boolean;
}

function EmojiPickerCategoryTab({ tab, isDisabled }: EmojiPickerCategoryTabProps): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerCategories");
	const { jumpTo } = context;
	const handleClick = React.useCallback((): void => {
		jumpTo(tab.id);
	}, [jumpTo, tab.id]);
	return (
		<TabsTrigger
			value={tab.id}
			aria-label={tab.label}
			aria-controls={context.listId}
			title={tab.label}
			disabled={isDisabled}
			data-slot="emoji-picker-category"
			data-category={tab.id}
			className={TAB_CLASS}
			onClick={handleClick}>
			{tab.icon}
		</TabsTrigger>
	);
}

export type EmojiPickerCategoriesProps = React.ComponentProps<"div">;

/**
 * Category tabs, the Tabs in its line variant, that jump the grid and follow
 * its scroll. Arrow keys move between them; Enter or Space jumps. A jump
 * during a search clears it.
 */
const EmojiPickerCategories = React.forwardRef<HTMLDivElement, EmojiPickerCategoriesProps>(function EmojiPickerCategories({ className, ...props }, ref): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerCategories");
	const isSearching = context.query.trim() !== "";
	const isPlaceholder = context.status !== "ready";
	const tabs = isPlaceholder ? context.placeholderTabs : context.tabs;
	const [firstTab] = tabs;
	const current = isSearching ? "" : (context.activeSection ?? firstTab?.id ?? "");

	return (
		<div
			ref={ref}
			data-slot="emoji-picker-categories"
			className={cn(
				/* A divider on the grid's side: below the tabs over the grid, above them under it. */
				"shrink-0 border-b px-(--emoji-picker-padding) first:pt-(--emoji-picker-padding) last:pb-(--emoji-picker-padding) [[data-slot=emoji-picker-list]~&]:border-t [[data-slot=emoji-picker-list]~&]:border-b-0 [[data-slot=emoji-picker-list]~&]:pt-1",
				className,
			)}
			{...props}>
			{/* Controlled by the scroll, not by a pick: a click jumps, and the grid's
			    scroll then moves the tab. */}
			<Tabs value={current}>
				<TabsList variant="line" aria-label={context.labels.categories} className="w-full justify-between">
					{tabs.map((tab: EmojiPickerSection): React.JSX.Element => (
						<EmojiPickerCategoryTab key={tab.id} tab={tab} isDisabled={isPlaceholder || context.disabled} />
					))}
				</TabsList>
			</Tabs>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

export type EmojiPickerFooterProps = React.ComponentProps<"div">;

/** The row under the grid: the preview and the skin tone by default. */
const EmojiPickerFooter = React.forwardRef<HTMLDivElement, EmojiPickerFooterProps>(function EmojiPickerFooter({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="emoji-picker-footer" className={cn("flex h-10 shrink-0 items-center gap-2 border-t px-(--emoji-picker-padding)", className)} {...props} />;
});

export type EmojiPickerPreviewProps = React.ComponentProps<"div">;

/**
 * The highlighted emoji, large, with its name and first shortcode; the value
 * while nothing is highlighted. Visual only: the grid already announces it.
 */
const EmojiPickerPreview = React.forwardRef<HTMLDivElement, EmojiPickerPreviewProps>(function EmojiPickerPreview({ className, ...props }, ref): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerPreview");
	const { labels } = context;
	const [firstValue] = context.values;
	const fallback = !context.multiple && firstValue !== undefined && firstValue !== "" ? context.findByValue(firstValue) : undefined;
	const emoji = context.activeEmoji ?? fallback ?? null;
	const activeValue = context.activeEmoji === null ? undefined : getEmojiValue(context.activeEmoji, context.activeEmoji.skins === undefined ? 0 : context.skinTone);
	const value = activeValue ?? firstValue ?? "";
	const [shortcode] = emoji?.shortcodes ?? [];

	return (
		<div ref={ref} aria-hidden="true" data-slot="emoji-picker-preview" className={cn("flex min-w-0 flex-1 items-center gap-2 select-none", className)} {...props}>
			{emoji === null ? (
				<>
					<span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-5">{EMOJI_PICKER_TRIGGER_ICON}</span>
					<span className="truncate text-sm text-muted-foreground">{labels.preview}</span>
				</>
			) : (
				<>
					<EmojiGlyph emoji={emoji} value={value} className="shrink-0 text-xl" />
					{/* One line, so the footer stays as dense as the grid. Without room the
					    shortcode wraps onto a second, clipped line rather than truncating
					    to a stray colon; a long name truncates. */}
					<span className="flex h-5 min-w-0 flex-1 flex-wrap items-baseline gap-x-2 overflow-hidden">
						<span className="max-w-full truncate text-sm leading-5 font-medium">{labels.formatLabel(emoji.label)}</span>
						{shortcode === undefined ? null : <span className="text-xs leading-5 text-muted-foreground">:{shortcode}:</span>}
					</span>
				</>
			)}
		</div>
	);
});

export {
	EmojiPicker,
	EmojiPickerCategories,
	EmojiPickerContent,
	EmojiPickerFooter,
	EmojiPickerHeader,
	EmojiPickerList,
	EmojiPickerPanel,
	EmojiPickerPreview,
	EmojiPickerSearch,
	EmojiPickerSkinTone,
	EmojiPickerTrigger,
	EmojiPickerValue,
	emojiPickerPanelVariants,
	useEmojiPicker,
};
export type { EmojiPickerListProps } from "@workspace/ui/components/emoji-picker-list";
export type { EmojiPickerFunctions, EmojiPickerI18nOverrides, EmojiPickerLabels, EmojiPickerTextLabels } from "@workspace/ui/components/emoji-picker-context";
export { useEmojiPickerData, type EmojiPickerDataState, type EmojiPickerProps, type UseEmojiPickerDataOptions } from "@workspace/ui/components/emoji-picker-state";
export {
	EMOJI_PICKER_CATEGORIES,
	EMOJI_PICKER_SKIN_TONES,
	EmojibaseDataSchema,
	EmojibaseMessagesSchema,
	EmojibaseShortcodesSchema,
	loadEmojiPickerData,
	normalizeEmojibaseData,
	type EmojiPickerCategory,
	type EmojiPickerCustomCategory,
	type EmojiPickerCustomEmoji,
	type EmojiPickerData,
	type EmojiPickerDataOptions,
	type EmojiPickerDataStatus,
	type EmojiPickerEmoji,
	type EmojiPickerRecentEntry,
	type EmojiPickerSelection,
	type EmojiPickerShortcodePreset,
} from "@workspace/ui/lib/emoji-picker/data";
export type { EmojiPickerSize } from "@workspace/ui/lib/emoji-picker/layout";
export { findEmoji, getEmojiValue, isEmojiValue, searchEmojis } from "@workspace/ui/lib/emoji-picker/search";
