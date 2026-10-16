"use client";

import type { EmojiPickerData, EmojiPickerDataStatus, EmojiPickerEmoji, EmojiPickerSkinTone } from "@workspace/ui/lib/emoji-picker/data";
import type { EmojiPickerLayout, EmojiPickerMove, EmojiPickerSection, EmojiPickerSizeTokens, GridPosition } from "@workspace/ui/lib/emoji-picker/layout";
import { cn } from "@workspace/ui/lib/core/utils";
import type { FieldState } from "@workspace/ui/lib/form/field-state";
import {
	CarIcon,
	ClockIcon,
	CoffeeIcon,
	FlagIcon,
	HeartIcon,
	LeafIcon,
	LightbulbIcon,
	SearchIcon,
	SmileIcon,
	SmilePlusIcon,
	SparklesIcon,
	UserRoundIcon,
	VolleyballIcon,
	XIcon,
} from "lucide-react";
import * as React from "react";

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/** Every string the emoji picker renders or announces (the `emojiPicker` UI kit label family). */
export interface EmojiPickerLabels {
	/** The trigger's name while there is no value. */
	readonly trigger: string;
	/** Names the popup and an inline panel. */
	readonly panel: string;
	/** Search placeholder and name. */
	readonly search: string;
	readonly clearSearch: string;
	/** Names the grid. */
	readonly list: string;
	/** Names the category tabs. */
	readonly categories: string;
	/** The recent section under `recentMode="frequent"`. */
	readonly frequent: string;
	/** The recent section under `recentMode="recent"`. */
	readonly recent: string;
	readonly searchResults: string;
	/** Custom emoji with no `customCategories` entry. */
	readonly custom: string;
	readonly smileys: string;
	readonly people: string;
	readonly nature: string;
	readonly food: string;
	readonly travel: string;
	readonly activities: string;
	readonly objects: string;
	readonly symbols: string;
	readonly flags: string;
	readonly skinTone: string;
	/** Default, then light to dark. */
	readonly skinTones: readonly [string, string, string, string, string, string];
	readonly empty: string;
	readonly emptyHint: string;
	readonly loading: string;
	readonly error: string;
	readonly retry: string;
	/** The preview while nothing is highlighted. */
	readonly preview: string;
	/** Announced after a search. */
	readonly formatResultCount: (count: number) => string;
	/** Announced after a pick that keeps the picker open. */
	readonly formatSelected: (label: string) => string;
	/** The display name, from the lowercase data label. */
	readonly formatLabel: (label: string) => string;
}

export type EmojiPickerFunctions = Pick<EmojiPickerLabels, "formatResultCount" | "formatSelected" | "formatLabel">;

export type EmojiPickerTextLabels = Omit<EmojiPickerLabels, keyof EmojiPickerFunctions>;

/** reui's per-usage override shape: strings and formatters, each partial. Laid over the `emojiPicker` label family. */
export interface EmojiPickerI18nOverrides {
	readonly labels?: Partial<EmojiPickerTextLabels>;
	readonly functions?: Partial<EmojiPickerFunctions>;
}

/* -------------------------------------------------------------------------- */
/*                                   Icons                                    */
/* -------------------------------------------------------------------------- */

export const EMOJI_PICKER_CATEGORY_ICONS: ReadonlyMap<string, React.ReactNode> = new Map<string, React.ReactNode>([
	["recent", <ClockIcon key="recent" aria-hidden="true" />],
	["smileys", <SmileIcon key="smileys" aria-hidden="true" />],
	["people", <UserRoundIcon key="people" aria-hidden="true" />],
	["nature", <LeafIcon key="nature" aria-hidden="true" />],
	["food", <CoffeeIcon key="food" aria-hidden="true" />],
	["travel", <CarIcon key="travel" aria-hidden="true" />],
	["activities", <VolleyballIcon key="activities" aria-hidden="true" />],
	["objects", <LightbulbIcon key="objects" aria-hidden="true" />],
	["symbols", <HeartIcon key="symbols" aria-hidden="true" />],
	["flags", <FlagIcon key="flags" aria-hidden="true" />],
]);

export const EMOJI_PICKER_CUSTOM_ICON: React.ReactNode = <SparklesIcon aria-hidden="true" />;

export const EMOJI_PICKER_TRIGGER_ICON: React.ReactNode = <SmilePlusIcon aria-hidden="true" />;

export const EMOJI_PICKER_SEARCH_ICON: React.ReactNode = <SearchIcon aria-hidden="true" />;

export const EMOJI_PICKER_CLEAR_ICON: React.ReactNode = <XIcon aria-hidden="true" />;

/** A category's tab icon: its own, or the custom sparkle. */
export function emojiPickerCategoryIcon(id: string): React.ReactNode {
	return EMOJI_PICKER_CATEGORY_ICONS.get(id) ?? EMOJI_PICKER_CUSTOM_ICON;
}

/* -------------------------------------------------------------------------- */
/*                                   Context                                  */
/* -------------------------------------------------------------------------- */

export interface EmojiPickerActiveCell {
	readonly section: string;
	readonly id: string;
	/* Arrow keys scroll the cell into view and keep Left and Right in the grid;
	   a hovered cell does neither. */
	readonly source: "keyboard" | "pointer";
}

export interface EmojiPickerPickEvent {
	readonly shiftKey?: boolean;
}

export interface EmojiPickerContextValue {
	readonly id: string;
	readonly listId: string;
	readonly data: EmojiPickerData | null;
	readonly status: EmojiPickerDataStatus;
	readonly retry: () => void;
	readonly requestData: () => void;
	readonly emojis: readonly EmojiPickerEmoji[];
	readonly labels: EmojiPickerLabels;
	readonly size: EmojiPickerSizeTokens;
	readonly columns: number | "auto";
	readonly columnCount: number;
	readonly setMeasuredColumns: (columns: number) => void;
	readonly query: string;
	readonly setQuery: (query: string) => void;
	readonly skinTone: EmojiPickerSkinTone;
	readonly setSkinTone: (tone: EmojiPickerSkinTone) => void;
	/** The tabs: every category with emoji, whatever the query. */
	readonly tabs: readonly EmojiPickerSection[];
	/** Disabled stand-ins until the data lands, so the row does not jump. */
	readonly placeholderTabs: readonly EmojiPickerSection[];
	/** What the grid shows: the tabs, or the search results. */
	readonly layout: EmojiPickerLayout;
	readonly active: EmojiPickerActiveCell | null;
	readonly activePosition: GridPosition | undefined;
	readonly activeEmoji: EmojiPickerEmoji | null;
	readonly setActive: (cell: EmojiPickerActiveCell | null) => void;
	readonly activeSection: string | null;
	readonly setActiveSection: (id: string | null) => void;
	readonly jump: string | null;
	readonly setJump: (id: string | null) => void;
	readonly jumpTo: (id: string) => void;
	readonly setPageRows: (rows: number) => void;
	readonly navigate: (event: React.KeyboardEvent<HTMLElement>, fromSearch: boolean) => void;
	readonly move: (to: EmojiPickerMove) => void;
	/** A scroll the keyboard did not make hands the highlight to the pointer. */
	readonly releaseKeyboard: () => void;
	/** The search or the grid holds focus, so a keyboard highlight shows. */
	readonly focused: boolean;
	readonly setFocused: (focused: boolean) => void;
	readonly pick: (emoji: EmojiPickerEmoji, event?: EmojiPickerPickEvent) => void;
	readonly clear: () => void;
	readonly isSelected: (emoji: EmojiPickerEmoji) => boolean;
	/** True when `max` is reached: unselected cells refuse a pick. */
	readonly full: boolean;
	readonly valueMode: boolean;
	readonly multiple: boolean;
	readonly values: readonly string[];
	readonly findByValue: (value: string) => EmojiPickerEmoji | undefined;
	readonly renderEmoji: ((emoji: EmojiPickerEmoji, value: string) => React.ReactNode) | undefined;
	readonly announcement: string;
	readonly disabled: boolean;
	readonly invalid: boolean;
	/** The CVA `state` of the picker's surfaces. */
	readonly fieldState: FieldState;
	readonly label: string | undefined;
	readonly labelledBy: string | undefined;
	readonly describedBy: string | undefined;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	readonly searchRef: React.RefObject<HTMLInputElement | null>;
	readonly listRef: React.RefObject<HTMLDivElement | null>;
	/** The root's forwarded ref, which the trigger takes. */
	readonly triggerRef: React.Ref<HTMLButtonElement> | undefined;
	readonly registerFocusTarget: (node: HTMLElement | null) => void;
}

export const EmojiPickerContext = React.createContext<EmojiPickerContextValue | null>(null);

/** "inline" unless a part renders inside `EmojiPickerContent`. */
export const EmojiPickerSurfaceContext = React.createContext<"inline" | "popup">("inline");

export function useEmojiPickerContext(part: string): EmojiPickerContextValue {
	const context = React.useContext(EmojiPickerContext);
	if (context === null) {
		throw new Error(`${part} must be used within an EmojiPicker`);
	}
	return context;
}

/** The id of one grid option, for `aria-activedescendant`. */
export function emojiPickerOptionId(listId: string, at: GridPosition): string {
	return `${listId}-${String(at.row)}-${String(at.col)}`;
}

/* -------------------------------------------------------------------------- */
/*                                    Glyph                                   */
/* -------------------------------------------------------------------------- */

/* The emoji font stack, swappable through `--emoji-picker-font` for a
   self-hosted color font. */
export const EMOJI_FONT_CLASS =
	"font-[family-name:var(--emoji-picker-font,Apple_Color_Emoji,Twemoji_Mozilla,Segoe_UI_Emoji,Segoe_UI_Symbol,Noto_Color_Emoji,sans-serif)] leading-none";

/** Intrinsic size (px) of a custom emoji image: 64px stays sharp at every grid size. */
const CUSTOM_EMOJI_IMAGE_PX = 64;

export interface EmojiGlyphProps {
	readonly emoji: EmojiPickerEmoji | undefined | null;
	readonly value: string;
	readonly className?: string;
}

/** One emoji, drawn like the grid draws it: `renderEmoji`, a custom image, or the native glyph. */
export function EmojiGlyph({ emoji, value, className }: EmojiGlyphProps): React.JSX.Element {
	const context = React.useContext(EmojiPickerContext);
	const renderEmoji = context?.renderEmoji;
	if (emoji !== undefined && emoji !== null && renderEmoji !== undefined) {
		return <>{renderEmoji(emoji, value)}</>;
	}
	if (emoji?.src !== undefined) {
		return (
			<img
				src={emoji.src}
				alt=""
				width={CUSTOM_EMOJI_IMAGE_PX}
				height={CUSTOM_EMOJI_IMAGE_PX}
				loading="lazy"
				decoding="async"
				draggable={false}
				className={cn("size-[1em] object-contain", className)}
			/>
		);
	}
	return <span className={cn(EMOJI_FONT_CLASS, className)}>{value}</span>;
}
