"use client";

import { hasGlobalConstructor, isBrowserRuntime, isStringPrimitive } from "@workspace/shared";
import {
	type EmojiPickerActiveCell,
	type EmojiPickerContextValue,
	type EmojiPickerI18nOverrides,
	type EmojiPickerLabels,
	type EmojiPickerPickEvent,
	emojiPickerCategoryIcon,
} from "@workspace/ui/components/emoji-picker-context";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import {
	DEFAULT_EMOJI_PICKER_LOCALE,
	DEFAULT_EMOJI_PICKER_SHORTCODES,
	EMOJI_PICKER_CATEGORIES,
	EmojiPickerCategorySchema,
	EmojiPickerShortcodePresetSchema,
	emojiPickerDataKey,
	loadEmojiPickerData,
	readLoadedEmojiPickerData,
	shortcodePresetsOf,
	type EmojiPickerCategory,
	type EmojiPickerCustomCategory,
	type EmojiPickerCustomEmoji,
	type EmojiPickerData,
	type EmojiPickerDataOptions,
	type EmojiPickerDataStatus,
	type EmojiPickerEmoji,
	type EmojiPickerRecentEntry,
	type EmojiPickerSelection,
	type EmojiPickerShortcodes,
	type EmojiPickerSkinTone,
} from "@workspace/ui/lib/emoji-picker/data";
import {
	buildLayout,
	cellKey,
	EMOJI_PICKER_DEFAULT_COLUMNS,
	EMOJI_PICKER_DEFAULT_RECENT_ROWS,
	EMOJI_PICKER_RECENT_CAP,
	EMOJI_PICKER_SIZES,
	EMOJI_PICKER_VISIBLE_ROWS,
	moveActiveCell,
	type EmojiPickerMove,
	type EmojiPickerSection,
	type EmojiPickerSize,
	type GridPosition,
} from "@workspace/ui/lib/emoji-picker/layout";
import { bareEmojiValue, getEmojiValue, isEmojiValue, isRegionalFlag, normalizeCustomEmoji, searchEmojis } from "@workspace/ui/lib/emoji-picker/search";
import {
	EMOJI_PICKER_RECENT_STORAGE_KEY,
	EMOJI_PICKER_SKIN_TONE_STORAGE_KEY,
	parseStoredRecent,
	parseStoredTone,
	readStoredValue,
	subscribeStoredValue,
	writeStoredValue,
} from "@workspace/ui/lib/emoji-picker/storage";
import { detectEmojiSupport, FULL_EMOJI_SUPPORT, type EmojiSupport } from "@workspace/ui/lib/emoji-picker/support";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import * as React from "react";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                 Data hook                                  */
/* -------------------------------------------------------------------------- */

export interface UseEmojiPickerDataOptions extends EmojiPickerDataOptions {
	/** Data already in hand, bundled or loaded on the server. Skips the fetch. */
	readonly data?: EmojiPickerData | undefined;
	/** Holds the fetch until true. */
	readonly enabled?: boolean;
}

export interface EmojiPickerDataState {
	readonly data: EmojiPickerData | null;
	readonly status: EmojiPickerDataStatus;
	readonly error: Error | undefined;
	readonly retry: () => void;
}

interface DataResult {
	readonly key: string;
	readonly data?: EmojiPickerData;
	readonly error?: Error;
}

const PresetListSchema = z.array(EmojiPickerShortcodePresetSchema);

/** The shortcode setting a preset key stands for (`""` = none). */
function presetsFromKey(presetKey: string): EmojiPickerShortcodes {
	if (presetKey === "") {
		return false;
	}
	const parsed = PresetListSchema.safeParse(presetKey.split("+"));
	return parsed.success ? parsed.data : false;
}

function resolveDataStatus(data: EmojiPickerData | null, error: Error | undefined, enabled: boolean): EmojiPickerDataStatus {
	if (data !== null) {
		return "ready";
	}
	if (error !== undefined) {
		return "error";
	}
	return enabled ? "loading" : "idle";
}

/** Loads emoji data for a custom surface: a shortcode autocomplete, a reaction bar. */
export function useEmojiPickerData(options: UseEmojiPickerDataOptions = {}): EmojiPickerDataState {
	const { data: provided, enabled = true, locale = DEFAULT_EMOJI_PICKER_LOCALE, url } = options;
	/* A string, so an inline array does not refetch every render. */
	const presetKey = shortcodePresetsOf(options.shortcodes).join("+");
	const key = emojiPickerDataKey({ locale, url, shortcodes: options.shortcodes });
	const [result, setResult] = React.useState<DataResult | null>(null);
	const [attempt, setAttempt] = React.useState(0);
	const ready = readLoadedEmojiPickerData({ locale, url, shortcodes: options.shortcodes });

	React.useEffect((): (() => void) | undefined => {
		const shortcodes = presetsFromKey(presetKey);
		if (provided !== undefined || !enabled || readLoadedEmojiPickerData({ locale, url, shortcodes }) !== undefined) {
			return undefined;
		}
		let isAlive = true;
		loadEmojiPickerData({ locale, url, shortcodes })
			.then((data: EmojiPickerData): void => {
				if (isAlive) {
					setResult({ key, data });
				}
			})
			.catch((error: unknown): void => {
				if (isAlive) {
					setResult({ key, error: error instanceof Error ? error : new Error("Emoji data failed to load", { cause: error }) });
				}
			});
		return (): void => {
			isAlive = false;
		};
	}, [provided, enabled, key, locale, url, presetKey, attempt]);

	const current = result?.key === key ? result : null;
	const data = provided ?? current?.data ?? ready ?? null;
	const retry = React.useCallback((): void => {
		setResult(null);
		setAttempt((count: number): number => count + 1);
	}, []);
	return { data, status: resolveDataStatus(data, current?.error, enabled), error: current?.error, retry };
}

/* -------------------------------------------------------------------------- */
/*                               External stores                              */
/* -------------------------------------------------------------------------- */

function subscribeNothing(): () => void {
	return (): void => undefined;
}

function readNothing(): null {
	return null;
}

/* One stored string, shared live by every picker and tab using the key. The
   server renders nothing stored, so markup never depends on the visitor. */
function useStoredValue(key: string | null): string | null {
	const subscribe = React.useCallback((listener: () => void): (() => void) => (key === null ? subscribeNothing() : subscribeStoredValue(key, listener)), [key]);
	const getSnapshot = React.useCallback((): string | null => (key === null ? null : readStoredValue(key)), [key]);
	return React.useSyncExternalStore(subscribe, getSnapshot, readNothing);
}

function fullSupport(): EmojiSupport {
	return FULL_EMOJI_SUPPORT;
}

/* Read through an external store: the server and the hydrating client both see
   full support, then the client re-renders once with what it can draw. */
function useEmojiSupport(data: EmojiPickerData | null, setting: number | "auto"): EmojiSupport {
	const getSnapshot = React.useCallback((): EmojiSupport => (setting === "auto" && data !== null ? detectEmojiSupport(data.emojis) : FULL_EMOJI_SUPPORT), [data, setting]);
	const detected = React.useSyncExternalStore(subscribeNothing, getSnapshot, fullSupport);
	/* One identity per setting: a fresh object each render would re-filter the
	   whole data set on every hover. */
	return React.useMemo((): EmojiSupport => (setting === "auto" ? detected : { version: setting, flags: true }), [setting, detected]);
}

/* -------------------------------------------------------------------------- */
/*                                    Props                                   */
/* -------------------------------------------------------------------------- */

interface EmojiPickerSingleProps {
	readonly multiple?: false | undefined;
	/** Controlled value: a native emoji, or `:shortcode:` for a custom one. `null` is empty. */
	readonly value?: string | null | undefined;
	readonly defaultValue?: string | null | undefined;
	readonly onValueChange?: ((value: string | null) => void) | undefined;
	readonly max?: undefined;
}

interface EmojiPickerMultipleProps {
	/** Picks toggle in and out of a list of values, and the picker stays open. */
	readonly multiple: true;
	readonly value?: readonly string[] | undefined;
	readonly defaultValue?: readonly string[] | undefined;
	readonly onValueChange?: ((value: string[]) => void) | undefined;
	/** The most values a person can pick; cells refuse further picks at the cap. */
	readonly max?: number | undefined;
}

export interface EmojiPickerCommonProps extends Pick<React.AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby"> {
	/** Fires on every pick, with the toned value and the emoji. The insert-into-text hook. */
	readonly onEmojiSelect?: ((selection: EmojiPickerSelection) => void) | undefined;
	readonly open?: boolean | undefined;
	readonly defaultOpen?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	/** Closes the popover after a pick. Defaults to true, false with `multiple`. Shift+click keeps it open either way. */
	readonly closeOnSelect?: boolean | undefined;
	/** Data already in hand (bundled, or loaded on the server). Skips the fetch. */
	readonly data?: EmojiPickerData | undefined;
	/** An emojibase locale: names, keywords and category labels in that language. */
	readonly locale?: string | undefined;
	/** Base URL of a self-hosted emojibase-data copy. Omitted: the data bundled with the app (emojibase-data), loaded per locale on first use — no network request. */
	readonly dataUrl?: string | undefined;
	/** Shortcode sets searched and shown. `false` skips the request. */
	readonly shortcodes?: EmojiPickerShortcodes | undefined;
	/** Hides emoji newer than this Emoji version. `"auto"` probes what the device draws, flags included. */
	readonly emojiVersion?: number | "auto" | undefined;
	/** Which sections show, in order: `recent`, custom category ids and category keys. */
	readonly categories?: readonly string[] | undefined;
	/** Drops emoji. Pass a stable function; it runs per emoji. */
	readonly filter?: ((emoji: EmojiPickerEmoji) => boolean) | undefined;
	readonly customEmojis?: readonly EmojiPickerCustomEmoji[] | undefined;
	readonly customCategories?: readonly EmojiPickerCustomCategory[] | undefined;
	/** Orders the recent section by use count, or by last use. */
	readonly recentMode?: "frequent" | "recent" | undefined;
	/** How many recent emoji show. Defaults to 2 rows; 0 hides the section. */
	readonly recentLimit?: number | undefined;
	/** Controlled recent list, for syncing it to an account. */
	readonly recent?: readonly EmojiPickerRecentEntry[] | undefined;
	readonly defaultRecent?: readonly EmojiPickerRecentEntry[] | undefined;
	readonly onRecentChange?: ((recent: EmojiPickerRecentEntry[]) => void) | undefined;
	/** localStorage key for the recent list; `null` keeps it in memory. */
	readonly recentStorageKey?: string | null | undefined;
	readonly skinTone?: EmojiPickerSkinTone | undefined;
	readonly defaultSkinTone?: EmojiPickerSkinTone | undefined;
	readonly onSkinToneChange?: ((tone: EmojiPickerSkinTone) => void) | undefined;
	/** localStorage key for the skin tone; `null` keeps it in memory. */
	readonly skinToneStorageKey?: string | null | undefined;
	/** Controlled search text. */
	readonly query?: string | undefined;
	readonly onQueryChange?: ((query: string) => void) | undefined;
	readonly size?: EmojiPickerSize | undefined;
	/** Cells per row. `"auto"` fills the panel's width. */
	readonly columns?: number | "auto" | undefined;
	/** Draws an emoji: an image set, a sprite, a brand font. */
	readonly renderEmoji?: ((emoji: EmojiPickerEmoji, value: string) => React.ReactNode) | undefined;
	readonly disabled?: boolean | undefined;
	/** Styles the trigger and panel as invalid and sets `aria-invalid` on the trigger. */
	readonly invalid?: boolean | undefined;
	/** Submits the value with a native form; multiple values are comma-joined. */
	readonly name?: string | undefined;
	readonly form?: string | undefined;
	readonly required?: boolean | undefined;
	/** The hidden form field, for form libraries that focus a field on error. */
	readonly inputRef?: React.Ref<HTMLInputElement> | undefined;
	/** Lands on the trigger. */
	readonly id?: string | undefined;
	/** Per-usage copy, laid over the `emojiPicker` UI kit labels. */
	readonly i18n?: EmojiPickerI18nOverrides | undefined;
	/** Without children the picker renders a trigger and a popover; this reaches the trigger. */
	readonly className?: string | undefined;
	/** Without children, lands on the default trigger. */
	readonly onFocus?: React.FocusEventHandler<HTMLButtonElement> | undefined;
	/** Without children, lands on the default trigger. */
	readonly onBlur?: React.FocusEventHandler<HTMLButtonElement> | undefined;
	readonly children?: React.ReactNode;
}

export type EmojiPickerProps = (EmojiPickerSingleProps | EmojiPickerMultipleProps) & EmojiPickerCommonProps;

/* -------------------------------------------------------------------------- */
/*                                 Controller                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_RECENT: readonly EmojiPickerRecentEntry[] = [];
const EMPTY_VALUES: readonly string[] = [];

/** The recent section's id, in `categories`. */
export const EMOJI_PICKER_RECENT_SECTION = "recent";

/** The search results' section id. */
const SEARCH_SECTION = "search";

function toValues(value: string | readonly string[] | null | undefined): readonly string[] {
	if (value === null || value === undefined || value === "") {
		return EMPTY_VALUES;
	}
	return isStringPrimitive(value) ? [value] : value;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value: string, index: number): boolean => value === right[index]);
}

/* An explicit label wins, then the data's own language, then the label pack. */
function categoryLabel(key: string, labels: EmojiPickerLabels, overrides: EmojiPickerI18nOverrides | undefined, data: EmojiPickerData | null): string | undefined {
	const parsed = EmojiPickerCategorySchema.safeParse(key);
	if (!parsed.success) {
		return undefined;
	}
	const category: EmojiPickerCategory = parsed.data;
	const fromData = data !== null && data.locale !== DEFAULT_EMOJI_PICKER_LOCALE ? data.categories[category] : undefined;
	return overrides?.labels?.[category] ?? fromData ?? labels[category];
}

interface SectionsInput {
	readonly all: readonly EmojiPickerEmoji[];
	readonly custom: readonly EmojiPickerEmoji[];
	readonly recent: readonly EmojiPickerEmoji[];
	readonly categories: readonly string[] | undefined;
	readonly customCategories: readonly EmojiPickerCustomCategory[] | undefined;
	readonly labels: EmojiPickerLabels;
	readonly recentMode: "frequent" | "recent";
	readonly i18n: EmojiPickerI18nOverrides | undefined;
	readonly data: EmojiPickerData | null;
}

function buildTabs(input: SectionsInput): EmojiPickerSection[] {
	const customIds = [
		...new Set([
			...(input.customCategories ?? []).map((category: EmojiPickerCustomCategory): string => category.id),
			...input.custom.map((emoji: EmojiPickerEmoji): string => emoji.category),
		]),
	];
	const order = input.categories ?? [EMOJI_PICKER_RECENT_SECTION, ...customIds, ...EMOJI_PICKER_CATEGORIES];
	const grouped = new Map<string, EmojiPickerEmoji[]>();
	for (const emoji of input.all) {
		const list = grouped.get(emoji.category);
		if (list === undefined) {
			grouped.set(emoji.category, [emoji]);
		} else {
			list.push(emoji);
		}
	}
	const sections: EmojiPickerSection[] = [];
	for (const key of new Set(order)) {
		const emojis = key === EMOJI_PICKER_RECENT_SECTION ? input.recent : (grouped.get(key) ?? []);
		if (emojis.length === 0) {
			continue;
		}
		const customCategory = input.customCategories?.find((item: EmojiPickerCustomCategory): boolean => item.id === key);
		sections.push({
			id: key,
			label:
				key === EMOJI_PICKER_RECENT_SECTION
					? input.labels[input.recentMode]
					: (customCategory?.label ?? categoryLabel(key, input.labels, input.i18n, input.data) ?? input.labels.custom),
			emojis,
			icon: customCategory?.icon ?? emojiPickerCategoryIcon(key),
		});
	}
	return sections;
}

function buildPlaceholderTabs(categories: readonly string[] | undefined, labels: EmojiPickerLabels): EmojiPickerSection[] {
	return (categories ?? EMOJI_PICKER_CATEGORIES).flatMap((key: string): EmojiPickerSection[] => {
		const parsed = EmojiPickerCategorySchema.safeParse(key);
		return parsed.success ? [{ id: key, label: labels[parsed.data], emojis: [], icon: emojiPickerCategoryIcon(key) }] : [];
	});
}

function filterUnicode(data: EmojiPickerData | null, support: EmojiSupport, filter: ((emoji: EmojiPickerEmoji) => boolean) | undefined): EmojiPickerEmoji[] {
	if (data === null) {
		return [];
	}
	return data.emojis.flatMap((emoji: EmojiPickerEmoji): EmojiPickerEmoji[] => {
		if (emoji.version > support.version || (!support.flags && isRegionalFlag(emoji.emoji)) || (filter !== undefined && !filter(emoji))) {
			return [];
		}
		return emoji.skins !== undefined && (emoji.skinVersion ?? 0) > support.version ? [{ ...emoji, skins: undefined, skinVersion: undefined }] : [emoji];
	});
}

/* The search, except on a touch screen, where focusing it would raise the
   keyboard over the grid and push the popover off screen. */
export function isTouchScreen(): boolean {
	return isBrowserRuntime() && hasGlobalConstructor("matchMedia") && window.matchMedia("(pointer: coarse)").matches;
}

export interface EmojiPickerController {
	readonly context: EmojiPickerContextValue;
	/** The hidden form field (when `name` or `required` is set), else `null`. */
	readonly field: React.ReactNode;
	readonly setOpen: (open: boolean) => void;
}

/* The hidden form field is read-only in practice, but `readOnly` would bar it
   from constraint validation, so `required` would never fire. */
function ignoreFieldChange(): void {
	return;
}

/** All of `EmojiPicker`'s state: values, data, search, highlight, keyboard and form wiring. */
export function useEmojiPickerController(props: EmojiPickerProps, triggerRef: React.Ref<HTMLButtonElement> | undefined): EmojiPickerController {
	const {
		onEmojiSelect,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		data: dataProp,
		locale = DEFAULT_EMOJI_PICKER_LOCALE,
		dataUrl,
		shortcodes = DEFAULT_EMOJI_PICKER_SHORTCODES,
		emojiVersion = "auto",
		categories,
		filter,
		customEmojis,
		customCategories,
		recentMode = "frequent",
		recentLimit,
		recent: recentProp,
		defaultRecent,
		onRecentChange,
		recentStorageKey = EMOJI_PICKER_RECENT_STORAGE_KEY,
		skinTone: skinToneProp,
		defaultSkinTone = 0,
		onSkinToneChange,
		skinToneStorageKey = EMOJI_PICKER_SKIN_TONE_STORAGE_KEY,
		query: queryProp,
		onQueryChange,
		size = "default",
		columns = EMOJI_PICKER_DEFAULT_COLUMNS,
		renderEmoji,
		disabled = false,
		invalid = false,
		name,
		form,
		required = false,
		inputRef,
		id: idProp,
		"aria-label": label,
		"aria-labelledby": labelledBy,
		"aria-describedby": describedBy,
		i18n,
	} = props;
	const multiple = props.multiple === true;
	const max = props.multiple === true ? props.max : undefined;
	const closeOnSelect = props.closeOnSelect ?? !multiple;
	const generatedId = React.useId();
	const id = idProp ?? generatedId;
	const listId = `${id}-list`;
	const tokens = EMOJI_PICKER_SIZES[size];

	const labelsOverride = React.useMemo((): Partial<EmojiPickerLabels> | undefined => (i18n === undefined ? undefined : { ...i18n.labels, ...i18n.functions }), [i18n]);
	const labels = useUiKitLabels("emojiPicker", labelsOverride);

	const [uncontrolled, setUncontrolled] = React.useState((): readonly string[] => toValues(props.defaultValue));
	/* What a form reset restores, as a native field returns to its default. */
	const [initialValues] = React.useState(uncontrolled);
	const values = props.value === undefined ? uncontrolled : toValues(props.value);
	const valueMode = props.value !== undefined || props.defaultValue !== undefined || multiple || name !== undefined;

	const [openState, setOpenState] = React.useState(defaultOpen);
	const open = openProp ?? openState;
	const [queryState, setQueryState] = React.useState("");
	const query = queryProp ?? queryState;
	const [active, setActiveState] = React.useState<EmojiPickerActiveCell | null>(null);
	const [focused, setFocused] = React.useState(false);
	const [activeSection, setActiveSection] = React.useState<string | null>(null);
	const [jump, setJump] = React.useState<string | null>(null);
	const [measuredColumns, setMeasuredColumns] = React.useState<number | null>(null);
	const [isDataWanted, setIsDataWanted] = React.useState(false);
	const [announcement, setAnnouncement] = React.useState("");
	/* Every open and close starts the grid over: no stale search, no stale highlight. */
	const [seenOpen, setSeenOpen] = React.useState(open);
	/* The recent list as it was before this session's first pick. The section
	   shows it until the next open, so a pick never inserts a section and moves
	   the grid under the pointer. */
	const [pinnedRecent, setPinnedRecent] = React.useState<readonly EmojiPickerRecentEntry[] | null>(null);
	if (seenOpen !== open) {
		setSeenOpen(open);
		setQueryState("");
		setActiveState(null);
		setFocused(false);
		setJump(null);
		setAnnouncement("");
		setPinnedRecent(null);
	}
	/* A language switch drops the last announcement, so the live region never
	   holds text in the previous language. */
	const [seenLocale, setSeenLocale] = React.useState(locale);
	if (seenLocale !== locale) {
		setSeenLocale(locale);
		setAnnouncement("");
	}
	const searchRef = React.useRef<HTMLInputElement | null>(null);
	const listRef = React.useRef<HTMLDivElement | null>(null);
	const focusTarget = React.useRef<HTMLElement | null>(null);
	const fieldNode = React.useRef<HTMLInputElement | null>(null);
	const resetRef = React.useRef((): void => undefined);
	const pageRows = React.useRef(EMOJI_PICKER_VISIBLE_ROWS);
	/* The column Up and Down aim for, kept across a shorter row. */
	const goalColumn = React.useRef<number | null>(null);

	const requestData = React.useCallback((): void => {
		setIsDataWanted(true);
	}, []);
	const { data, status, retry } = useEmojiPickerData({ data: dataProp, locale, url: dataUrl, shortcodes, enabled: isDataWanted || open });
	const support = useEmojiSupport(data, emojiVersion);
	const columnCount = columns === "auto" ? (measuredColumns ?? EMOJI_PICKER_DEFAULT_COLUMNS) : Math.max(1, columns);

	const unicode = React.useMemo((): EmojiPickerEmoji[] => filterUnicode(data, support, filter), [data, support, filter]);
	const custom = React.useMemo(
		(): EmojiPickerEmoji[] => (customEmojis ?? []).map(normalizeCustomEmoji).filter((emoji: EmojiPickerEmoji): boolean => filter === undefined || filter(emoji)),
		[customEmojis, filter],
	);
	const all = React.useMemo((): EmojiPickerEmoji[] => [...custom, ...unicode], [custom, unicode]);
	const byId = React.useMemo((): Map<string, EmojiPickerEmoji> => new Map(all.map((emoji: EmojiPickerEmoji): [string, EmojiPickerEmoji] => [emoji.id, emoji])), [all]);
	/* Every value the data can produce, filtered or not, for display. */
	const byValue = React.useMemo((): Map<string, EmojiPickerEmoji> => {
		const map = new Map<string, EmojiPickerEmoji>();
		for (const emoji of [...custom, ...(data?.emojis ?? [])]) {
			map.set(bareEmojiValue(getEmojiValue(emoji)), emoji);
			for (const skin of emoji.skins ?? []) {
				map.set(bareEmojiValue(skin), emoji);
			}
		}
		return map;
	}, [custom, data]);

	const storedRecent = useStoredValue(recentProp === undefined ? recentStorageKey : null);
	const parsedRecent = React.useMemo((): EmojiPickerRecentEntry[] | null => parseStoredRecent(storedRecent), [storedRecent]);
	const [memoryRecent, setMemoryRecent] = React.useState<readonly EmojiPickerRecentEntry[]>(defaultRecent ?? EMPTY_RECENT);
	const storageRecent = recentStorageKey === null ? memoryRecent : (parsedRecent ?? defaultRecent ?? EMPTY_RECENT);
	const recentEntries = recentProp ?? storageRecent;
	const shownRecent = recentLimit ?? columnCount * EMOJI_PICKER_DEFAULT_RECENT_ROWS;
	const shownEntries = pinnedRecent ?? recentEntries;
	const recent = React.useMemo((): EmojiPickerEmoji[] => {
		const ordered =
			recentMode === "frequent" ? [...shownEntries].sort((left: EmojiPickerRecentEntry, right: EmojiPickerRecentEntry): number => right.count - left.count) : shownEntries;
		return ordered
			.flatMap((entry: EmojiPickerRecentEntry): EmojiPickerEmoji[] => {
				const emoji = byId.get(entry.id);
				return emoji === undefined ? [] : [emoji];
			})
			.slice(0, shownRecent);
	}, [shownEntries, recentMode, byId, shownRecent]);

	const storedTone = useStoredValue(skinToneProp === undefined ? skinToneStorageKey : null);
	const [memoryTone, setMemoryTone] = React.useState<EmojiPickerSkinTone>(defaultSkinTone);
	const storageTone = skinToneStorageKey === null ? memoryTone : (parseStoredTone(storedTone) ?? defaultSkinTone);
	const skinTone = skinToneProp ?? storageTone;

	const tabs = React.useMemo(
		(): EmojiPickerSection[] => buildTabs({ all, custom, recent, categories, customCategories, labels, recentMode, i18n, data }),
		[all, custom, recent, categories, customCategories, labels, recentMode, i18n, data],
	);
	const placeholderTabs = React.useMemo((): EmojiPickerSection[] => buildPlaceholderTabs(categories, labels), [categories, labels]);

	const results = React.useMemo((): EmojiPickerEmoji[] | null => (query.trim() === "" ? null : searchEmojis(all, query)), [all, query]);
	const sections = React.useMemo((): readonly EmojiPickerSection[] => {
		if (results === null) {
			return tabs;
		}
		return results.length === 0 ? [] : [{ id: SEARCH_SECTION, label: labels.searchResults, emojis: results, icon: null }];
	}, [results, tabs, labels]);
	const layout = React.useMemo(() => buildLayout(sections, columnCount, tokens), [sections, columnCount, tokens]);

	/* With a query and nothing chosen yet, the first result is highlighted, so
	   Enter picks the best match. */
	const firstResult: GridPosition | undefined = results !== null && layout.rows.length > 0 ? { row: 0, col: 0 } : undefined;
	const activePosition = (active === null ? undefined : layout.positions.get(cellKey(active.section, active.id))) ?? firstResult;
	const activeEmoji = activePosition === undefined ? null : (layout.rows[activePosition.row]?.cells[activePosition.col] ?? null);

	const selected = React.useMemo((): Set<string> => new Set(values.map(bareEmojiValue)), [values]);
	const isSelected = (emoji: EmojiPickerEmoji): boolean =>
		selected.has(bareEmojiValue(getEmojiValue(emoji))) || (emoji.skins ?? []).some((skin: string): boolean => selected.has(bareEmojiValue(skin)));
	const full = multiple && max !== undefined && values.length >= max;

	const isOpenControlled = openProp !== undefined;
	const setOpen = React.useCallback(
		(next: boolean): void => {
			if (next && disabled) {
				return;
			}
			if (!isOpenControlled) {
				setOpenState(next);
			}
			onOpenChange?.(next);
		},
		[disabled, isOpenControlled, onOpenChange],
	);

	const setQuery = (next: string): void => {
		if (queryProp === undefined) {
			setQueryState(next);
		}
		onQueryChange?.(next);
		setActiveState(null);
		setAnnouncement("");
	};

	const setSkinTone = (tone: EmojiPickerSkinTone): void => {
		if (skinToneProp === undefined) {
			if (skinToneStorageKey === null) {
				setMemoryTone(tone);
			} else {
				writeStoredValue(skinToneStorageKey, String(tone));
			}
		}
		onSkinToneChange?.(tone);
	};

	const commitValues = (next: readonly string[]): void => {
		if (sameValues(next, values)) {
			return;
		}
		if (props.value === undefined) {
			setUncontrolled(next);
		}
		if (props.multiple === true) {
			props.onValueChange?.([...next]);
		} else {
			const [first = null] = next;
			props.onValueChange?.(first);
		}
	};

	const recordRecent = (emojiId: string): void => {
		if (pinnedRecent === null) {
			setPinnedRecent(recentEntries);
		}
		const previous = recentEntries.find((entry: EmojiPickerRecentEntry): boolean => entry.id === emojiId);
		const next = [{ id: emojiId, count: (previous?.count ?? 0) + 1 }, ...recentEntries.filter((entry: EmojiPickerRecentEntry): boolean => entry.id !== emojiId)].slice(
			0,
			EMOJI_PICKER_RECENT_CAP,
		);
		if (recentProp === undefined) {
			if (recentStorageKey === null) {
				setMemoryRecent(next);
			} else {
				writeStoredValue(recentStorageKey, JSON.stringify(next));
			}
		}
		onRecentChange?.(next);
	};

	const pick = (emoji: EmojiPickerEmoji, event?: EmojiPickerPickEvent): void => {
		if (disabled) {
			return;
		}
		const tone: EmojiPickerSkinTone = emoji.skins === undefined ? 0 : skinTone;
		const value = getEmojiValue(emoji, tone);
		if (multiple && isSelected(emoji)) {
			commitValues(values.filter((item: string): boolean => !isEmojiValue(emoji, item)));
			return;
		}
		if (full) {
			return;
		}
		commitValues(multiple ? [...values, value] : [value]);
		onEmojiSelect?.({ value, emoji, skinTone: tone });
		recordRecent(emoji.id);
		if (closeOnSelect && event?.shiftKey !== true && open) {
			setOpen(false);
		} else {
			setAnnouncement(labels.formatSelected(labels.formatLabel(emoji.label)));
		}
	};

	const setActive = (cell: EmojiPickerActiveCell | null): void => {
		goalColumn.current = null;
		setActiveState(cell);
	};

	const move = (to: EmojiPickerMove): void => {
		const result = moveActiveCell({
			layout,
			at: activePosition,
			to,
			scrollTop: listRef.current?.scrollTop ?? 0,
			headerPx: tokens.header,
			pageRows: pageRows.current,
			goalColumn: goalColumn.current,
			searching: results !== null,
		});
		if (result === null) {
			return;
		}
		if (result.kind === "release") {
			setActiveState(null);
			return;
		}
		goalColumn.current = result.goalColumn;
		setActiveState({ section: result.sectionId, id: result.emojiId, source: "keyboard" });
	};

	const navigate = (event: React.KeyboardEvent<HTMLElement>, fromSearch: boolean): void => {
		if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		/* Left and Right belong to the caret until the arrows enter the grid. */
		const inGrid = !fromSearch || active?.source === "keyboard";
		const run = (to: EmojiPickerMove): void => {
			event.preventDefault();
			move(to);
		};
		switch (event.key) {
			case "ArrowDown":
				run(activePosition === undefined ? "visible" : "down");
				return;
			case "ArrowUp":
				if (activePosition !== undefined) {
					run("up");
				} else if (!fromSearch) {
					run("visible");
				}
				return;
			case "ArrowRight":
			case "ArrowLeft": {
				if (!inGrid) {
					return;
				}
				const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";
				run((event.key === "ArrowRight") !== isRtl ? "next" : "prev");
				return;
			}
			case "PageDown":
				run("pageDown");
				return;
			case "PageUp":
				run("pageUp");
				return;
			case "Home":
			case "End":
				if (!fromSearch) {
					run(event.key === "Home" ? "first" : "last");
				}
				return;
			case "Enter":
			case " ":
				if ((event.key === " " && fromSearch) || activeEmoji === null) {
					return;
				}
				event.preventDefault();
				pick(activeEmoji, event);
				return;
			default:
				return;
		}
	};

	const fieldState = resolveFieldState({ disabled, loading: status === "loading", ariaInvalid: invalid });

	const registerFocusTarget = React.useCallback((node: HTMLElement | null): void => {
		if (node !== null) {
			focusTarget.current = node;
		}
	}, []);

	const context: EmojiPickerContextValue = {
		id,
		listId,
		data,
		status,
		retry,
		requestData,
		emojis: all,
		labels,
		size: tokens,
		columns,
		columnCount,
		setMeasuredColumns,
		query,
		setQuery,
		skinTone,
		setSkinTone,
		tabs,
		placeholderTabs,
		layout,
		active,
		activePosition,
		activeEmoji,
		setActive,
		activeSection,
		setActiveSection,
		jump,
		setJump,
		jumpTo: (sectionId: string): void => {
			if (results !== null) {
				setQuery("");
			}
			setActiveState(null);
			setJump(sectionId);
		},
		setPageRows: (rows: number): void => {
			pageRows.current = rows;
		},
		navigate,
		move,
		releaseKeyboard: (): void => {
			setActiveState((current: EmojiPickerActiveCell | null): EmojiPickerActiveCell | null => (current?.source === "keyboard" ? { ...current, source: "pointer" } : current));
		},
		focused,
		setFocused,
		pick,
		clear: (): void => {
			commitValues(EMPTY_VALUES);
		},
		isSelected,
		full,
		valueMode,
		multiple,
		values,
		findByValue: (value: string): EmojiPickerEmoji | undefined => byValue.get(bareEmojiValue(value)),
		renderEmoji,
		announcement,
		disabled,
		invalid,
		fieldState,
		label,
		labelledBy,
		describedBy,
		open,
		setOpen,
		searchRef,
		listRef,
		triggerRef,
		registerFocusTarget,
	};

	React.useEffect((): void => {
		resetRef.current = (): void => {
			commitValues(initialValues);
		};
	});

	/* Listens on the field's own root and asks for its form at reset time, so a
	   `form` attribute is honoured. The restore waits a task, like a native
	   reset's default action, because any listener may still cancel it. */
	const hasField = name !== undefined || required;
	React.useEffect((): (() => void) | undefined => {
		const root = fieldNode.current?.getRootNode();
		if (root === undefined) {
			return undefined;
		}
		let pending = 0;
		const onReset = (event: Event): void => {
			if (event.target !== fieldNode.current?.form) {
				return;
			}
			pending = window.setTimeout((): void => {
				if (!event.defaultPrevented) {
					resetRef.current();
				}
			});
		};
		root.addEventListener("reset", onReset, true);
		return (): void => {
			root.removeEventListener("reset", onReset, true);
			window.clearTimeout(pending);
		};
	}, [hasField]);

	const attachFieldNode = React.useCallback(
		(node: HTMLInputElement | null): void => {
			fieldNode.current = node;
			assignRef(inputRef, node);
		},
		[inputRef],
	);

	/* A failed `required` check focuses the hidden field; hand that to the control. */
	const onFieldFocus = React.useCallback((event: React.FocusEvent<HTMLInputElement>): void => {
		const target = focusTarget.current ?? searchRef.current;
		if (target === null) {
			event.currentTarget.blur();
		} else {
			target.focus();
		}
	}, []);

	return {
		context,
		setOpen,
		field: hasField ? (
			<input
				ref={attachFieldNode}
				type="text"
				name={name}
				form={form}
				required={required}
				disabled={disabled}
				value={values.join(",")}
				onChange={ignoreFieldChange}
				tabIndex={-1}
				aria-hidden="true"
				data-slot="emoji-picker-field"
				onFocus={onFieldFocus}
				className="pointer-events-none absolute size-px max-w-px opacity-0"
			/>
		) : null,
	};
}
