// An emoji picker (the web kit's `EmojiPicker`): a search box, a skin tone
// choice, a row of category tabs and a virtualized grid of emoji in sections
// (frequently used, the app's own custom emoji, then the Unicode categories).
// `EmojiPickerPanel` is the picker itself, for a screen or a card;
// `EmojiPicker` is a button that opens the panel in a bottom sheet and shows
// the picked emoji.
//
// Data-agnostic: the caller passes the emoji (`data`, from
// lib/emoji-picker's `emojiPickerDataFromEmojibase`, or `null` while it
// loads), the frequently used values and any custom emoji. Controlled at the
// edges: `onSelect(selection)` reports each pick; the search text, the open
// tone row and the shown section are the panel's own display state, and the
// skin tone is the caller's when it passes `skinTone`. Every label can be
// replaced (`labels`) for another language. The ref reaches the root view.

import { cva } from "class-variance-authority";
import { Image } from "expo-image";
import AppleIcon from "lucide-react-native/icons/apple";
import ClockIcon from "lucide-react-native/icons/clock";
import FlagIcon from "lucide-react-native/icons/flag";
import HandIcon from "lucide-react-native/icons/hand";
import HeartIcon from "lucide-react-native/icons/heart";
import LeafIcon from "lucide-react-native/icons/leaf";
import LightbulbIcon from "lucide-react-native/icons/lightbulb";
import PlaneIcon from "lucide-react-native/icons/plane";
import SearchIcon from "lucide-react-native/icons/search";
import SmileIcon from "lucide-react-native/icons/smile";
import SmilePlusIcon from "lucide-react-native/icons/smile-plus";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import VolleyballIcon from "lucide-react-native/icons/volleyball";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { ActivityIndicator, FlatList, type ListRenderItemInfo, Pressable, ScrollView, Text, TextInput, View, type ViewInstance, type ListViewToken } from "react-native";

import { cn } from "../lib/cn";
import {
	EMOJI_PICKER_CATEGORIES,
	EMOJI_PICKER_CUSTOM_CATEGORY,
	EMOJI_PICKER_SKIN_TONES,
	type EmojiPickerCategory,
	type EmojiPickerCustomEmoji,
	type EmojiPickerData,
	type EmojiPickerEmoji,
	type EmojiPickerSelection,
	type EmojiPickerSkinTone,
	findEmoji,
	getEmojiValue,
	normalizeCustomEmoji,
	searchEmojis,
} from "../lib/emoji-picker";
import { playSelectionFeedback } from "../lib/haptics";
import { BottomSheet } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/** Every word the picker shows or says, for another language. */
export interface EmojiPickerLabels {
	readonly searchPlaceholder: string;
	/** The search box's accessible name. */
	readonly search: string;
	readonly clearSearch: string;
	readonly noResults: string;
	readonly searchResults: string;
	readonly frequentlyUsed: string;
	/** The skin tone button's name. */
	readonly skinTone: string;
	/** The six tones' names, default yellow first. */
	readonly skinTones: readonly string[];
	readonly loading: string;
	/** A category's name when the data has none. */
	readonly categories: Readonly<Record<EmojiPickerCategory, string>>;
}

export const DEFAULT_EMOJI_PICKER_LABELS: EmojiPickerLabels = {
	searchPlaceholder: "Search emoji",
	search: "Search emoji",
	clearSearch: "Clear search",
	noResults: "No emoji found.",
	searchResults: "Search results",
	frequentlyUsed: "Frequently used",
	skinTone: "Skin tone",
	skinTones: ["Default", "Light", "Medium-light", "Medium", "Medium-dark", "Dark"],
	loading: "Loading emoji",
	categories: {
		smileys: "Smileys & Emotion",
		people: "People & Body",
		nature: "Animals & Nature",
		food: "Food & Drink",
		travel: "Travel & Places",
		activities: "Activities",
		objects: "Objects",
		symbols: "Symbols",
		flags: "Flags",
	},
};

const CATEGORY_ICONS: Readonly<Record<EmojiPickerCategory, LucideIcon>> = {
	smileys: SmileIcon,
	people: HandIcon,
	nature: LeafIcon,
	food: AppleIcon,
	travel: PlaneIcon,
	activities: VolleyballIcon,
	objects: LightbulbIcon,
	symbols: HeartIcon,
	flags: FlagIcon,
};

/** A waving hand in each tone: what the tone choices show. */
const TONE_SAMPLES: readonly string[] = ["👋", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"];

/* -------------------------------------------------------------------------- */
/*                                  Sections                                  */
/* -------------------------------------------------------------------------- */

/** An app's own category of custom emoji, with its tab glyph. */
export interface EmojiPickerCustomCategory {
	readonly id: string;
	readonly label: string;
	/** Tab glyph. Defaults to sparkles. */
	readonly icon?: LucideIcon | undefined;
}

/** One section of the grid: its tab and its emoji. */
export interface EmojiPickerSection {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly emojis: readonly EmojiPickerEmoji[];
}

/** One row of the grid: a section's heading, or a row of emoji. */
type GridRow =
	| { readonly kind: "heading"; readonly key: string; readonly label: string; readonly section: string }
	| { readonly kind: "emojis"; readonly key: string; readonly emojis: readonly EmojiPickerEmoji[]; readonly section: string };

const FREQUENT_SECTION = "frequent";

export interface EmojiPickerSectionsOptions {
	readonly data: EmojiPickerData;
	readonly frequent: readonly string[];
	readonly customEmoji: readonly EmojiPickerCustomEmoji[];
	readonly customCategories: readonly EmojiPickerCustomCategory[];
	/** `start`: custom sections before frequently used. Default `end` (after it). */
	readonly customPosition: "start" | "end";
	readonly excludeCategories: readonly EmojiPickerCategory[];
	readonly labels: EmojiPickerLabels;
}

/** The grid's sections, in order, without the empty ones. */
export function emojiPickerSectionsOf(options: EmojiPickerSectionsOptions): readonly EmojiPickerSection[] {
	const { data, frequent, customEmoji, customCategories, customPosition, excludeCategories, labels } = options;
	const customs = customEmoji.map(normalizeCustomEmoji);
	const everyEmoji = [...customs, ...data.emojis];
	const frequentSection: EmojiPickerSection = {
		id: FREQUENT_SECTION,
		label: labels.frequentlyUsed,
		icon: ClockIcon,
		emojis: frequent.flatMap((value: string): EmojiPickerEmoji[] => {
			const emoji = findEmoji(everyEmoji, value);
			return emoji === undefined ? [] : [emoji];
		}),
	};
	const categories = customCategories.length > 0 ? customCategories : [{ id: EMOJI_PICKER_CUSTOM_CATEGORY, label: "Custom" }];
	const customSections = categories.map((category: EmojiPickerCustomCategory): EmojiPickerSection => ({
		id: category.id,
		label: category.label,
		icon: category.icon ?? SparklesIcon,
		emojis: customs.filter((emoji: EmojiPickerEmoji): boolean => emoji.category === category.id),
	}));
	const unicodeSections = EMOJI_PICKER_CATEGORIES.filter((category: EmojiPickerCategory): boolean => !excludeCategories.includes(category)).map(
		(category: EmojiPickerCategory): EmojiPickerSection => ({
			id: category,
			label: data.categories[category] ?? labels.categories[category],
			icon: CATEGORY_ICONS[category],
			emojis: data.emojis.filter((emoji: EmojiPickerEmoji): boolean => emoji.category === category),
		}),
	);
	const ordered = customPosition === "start" ? [...customSections, frequentSection, ...unicodeSections] : [frequentSection, ...customSections, ...unicodeSections];
	return ordered.filter((section: EmojiPickerSection): boolean => section.emojis.length > 0);
}

/** The grid's rows: each section's heading, then its emoji `columns` to a row. */
function gridRowsOf(sections: readonly EmojiPickerSection[], columns: number): readonly GridRow[] {
	return sections.flatMap((section: EmojiPickerSection): GridRow[] => {
		const rowCount = Math.ceil(section.emojis.length / columns);
		const rows = Array.from({ length: rowCount }, (_row: undefined, index: number): GridRow => ({
			kind: "emojis",
			key: `${section.id}:${String(index)}`,
			emojis: section.emojis.slice(index * columns, (index + 1) * columns),
			section: section.id,
		}));
		return [{ kind: "heading", key: `${section.id}:heading`, label: section.label, section: section.id }, ...rows];
	});
}

/** The rows' fixed heights (h-8 headings, h-11 emoji rows), so the list can jump to a section without measuring. */
const HEADING_HEIGHT = 32;
const ROW_HEIGHT = 44;

interface RowLayout {
	readonly length: number;
	readonly offset: number;
	readonly index: number;
}

function rowLayoutsOf(rows: readonly GridRow[]): readonly RowLayout[] {
	let offset = 0;
	return rows.map((row: GridRow, index: number): RowLayout => {
		const length = row.kind === "heading" ? HEADING_HEIGHT : ROW_HEIGHT;
		const layout = { length, offset, index };
		offset += length;
		return layout;
	});
}

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

export const emojiPickerPanelVariants = cva("gap-2", {
	variants: {
		/** How tall the grid is: `md` for a card or a sheet, `lg` for a screen of its own. */
		size: { md: "", lg: "" },
		variant: { plain: "", card: "rounded-card border border-border bg-card p-3" },
	},
	defaultVariants: { size: "md", variant: "plain" },
});

const emojiGridVariants = cva("", {
	variants: {
		size: { md: "h-72", lg: "h-96" },
	},
	defaultVariants: { size: "md" },
});

/** A category tab: tinted while its section is the one shown. */
export const emojiPickerTabVariants = cva("size-10 items-center justify-center rounded-full", {
	variants: {
		active: { true: "bg-muted", false: "active:bg-muted" },
	},
	defaultVariants: { active: false },
});

/** One emoji: tinted while it is the value. */
export const emojiPickerCellVariants = cva("h-11 flex-1 items-center justify-center rounded-lg active:bg-muted", {
	variants: {
		chosen: { true: "bg-surface-selected", false: "" },
	},
	defaultVariants: { chosen: false },
});

export type EmojiPickerPanelSize = "md" | "lg";
export type EmojiPickerPanelVariant = "plain" | "card";

/** How many emoji a row holds by default: 8 fits a phone's width at 44 pt each with room to spare. */
const DEFAULT_COLUMNS = 8;
const NO_VALUES: readonly string[] = [];
const NO_CUSTOM_EMOJI: readonly EmojiPickerCustomEmoji[] = [];
const NO_CUSTOM_CATEGORIES: readonly EmojiPickerCustomCategory[] = [];
const NO_CATEGORIES: readonly EmojiPickerCategory[] = [];
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

export interface EmojiPickerPanelProps {
	/** The emoji, or `null` while they load (a spinner shows). */
	readonly data: EmojiPickerData | null;
	readonly onSelect: (selection: EmojiPickerSelection) => void;
	/** The current value: its cell is tinted. */
	readonly value?: string | null | undefined;
	/** Frequently used values, most used first: the first section. */
	readonly frequent?: readonly string[] | undefined;
	/** The app's own emoji (images), stored as `:shortcode:`. */
	readonly customEmoji?: readonly EmojiPickerCustomEmoji[] | undefined;
	/** The custom emoji's sections; without them, one "Custom" section. */
	readonly customCategories?: readonly EmojiPickerCustomCategory[] | undefined;
	/** `start`: the custom sections before frequently used. Default `end`. */
	readonly customPosition?: "start" | "end" | undefined;
	/** Unicode categories left out (a workplace set without flags, say). */
	readonly excludeCategories?: readonly EmojiPickerCategory[] | undefined;
	/** The skin tone: the caller's, with `onSkinToneChange`. */
	readonly skinTone?: EmojiPickerSkinTone | undefined;
	readonly onSkinToneChange?: ((tone: EmojiPickerSkinTone) => void) | undefined;
	/** Hide the skin tone choice. */
	readonly hideSkinTones?: boolean | undefined;
	/** Above the search box: quick reactions, a title. */
	readonly header?: React.ReactNode | undefined;
	readonly labels?: Partial<EmojiPickerLabels> | undefined;
	/** Emoji per row. Default 8. */
	readonly columns?: number | undefined;
	readonly size?: EmojiPickerPanelSize | undefined;
	readonly variant?: EmojiPickerPanelVariant | undefined;
	/** Focus the search box as the panel appears (in a sheet). */
	readonly autoFocusSearch?: boolean | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface EmojiCellProps {
	readonly emoji: EmojiPickerEmoji;
	readonly skinTone: EmojiPickerSkinTone;
	readonly chosen: boolean;
	readonly onPick: (emoji: EmojiPickerEmoji) => void;
}

const EmojiCell = React.memo(function EmojiCell({ emoji, skinTone, chosen, onPick }: EmojiCellProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(emoji);
	}, [emoji, onPick]);
	const accessibilityState = React.useMemo(() => ({ selected: chosen }), [chosen]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={emoji.label}
			accessibilityState={accessibilityState}
			onPress={pick}
			className={emojiPickerCellVariants({ chosen })}>
			{emoji.src === undefined ? (
				<Text className="text-h2">{getEmojiValue(emoji, skinTone)}</Text>
			) : (
				<Image source={emoji.src} accessibilityLabel={emoji.label} accessibilityIgnoresInvertColors contentFit="contain" className="size-7" />
			)}
		</Pressable>
	);
});

interface CategoryTabProps {
	readonly section: EmojiPickerSection;
	readonly active: boolean;
	readonly onPress: (id: string) => void;
}

const CategoryTab = React.memo(function CategoryTab({ section, active, onPress }: CategoryTabProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPress(section.id);
	}, [onPress, section.id]);
	const accessibilityState = React.useMemo(() => ({ selected: active }), [active]);
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityLabel={section.label}
			accessibilityState={accessibilityState}
			onPress={press}
			className={emojiPickerTabVariants({ active })}>
			<Icon icon={section.icon} size="sm" colorClassName={active ? "accent-foreground" : "accent-muted-foreground"} />
		</Pressable>
	);
});

interface ToneChoiceProps {
	readonly tone: EmojiPickerSkinTone;
	readonly label: string;
	readonly chosen: boolean;
	readonly onChoose: (tone: EmojiPickerSkinTone) => void;
}

const ToneChoice = React.memo(function ToneChoice({ tone, label, chosen, onChoose }: ToneChoiceProps): React.JSX.Element {
	const choose = React.useCallback((): void => {
		onChoose(tone);
	}, [onChoose, tone]);
	const accessibilityState = React.useMemo(() => ({ checked: chosen }), [chosen]);
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			onPress={choose}
			className={emojiPickerTabVariants({ active: chosen })}>
			<Text className="text-h3">{TONE_SAMPLES.at(tone)}</Text>
		</Pressable>
	);
});

export const EmojiPickerPanel = React.memo(
	React.forwardRef<ViewInstance, EmojiPickerPanelProps>(function EmojiPickerPanel(
		{
			data,
			onSelect,
			value = null,
			frequent = NO_VALUES,
			customEmoji = NO_CUSTOM_EMOJI,
			customCategories = NO_CUSTOM_CATEGORIES,
			customPosition = "end",
			excludeCategories = NO_CATEGORIES,
			skinTone: shownTone,
			onSkinToneChange,
			hideSkinTones = false,
			header,
			labels: labelOverrides,
			columns = DEFAULT_COLUMNS,
			size = "md",
			variant = "plain",
			autoFocusSearch = false,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): EmojiPickerLabels => ({ ...DEFAULT_EMOJI_PICKER_LABELS, ...labelOverrides }), [labelOverrides]);
		const [query, setQuery] = React.useState("");
		const [ownTone, setOwnTone] = React.useState<EmojiPickerSkinTone>(0);
		const [tonesOpen, setTonesOpen] = React.useState(false);
		const [activeSection, setActiveSection] = React.useState<string | null>(null);
		const listRef = React.useRef<FlatList<GridRow>>(null);
		const skinTone = shownTone ?? ownTone;

		const sections = React.useMemo(
			(): readonly EmojiPickerSection[] =>
				data === null ? [] : emojiPickerSectionsOf({ data, frequent, customEmoji, customCategories, customPosition, excludeCategories, labels }),
			[customCategories, customEmoji, customPosition, data, excludeCategories, frequent, labels],
		);
		const searching = query.trim().length > 0;
		const shownSections = React.useMemo((): readonly EmojiPickerSection[] => {
			if (!searching) {
				return sections;
			}
			const pool = sections.filter((section: EmojiPickerSection): boolean => section.id !== FREQUENT_SECTION).flatMap((section: EmojiPickerSection) => section.emojis);
			const found = searchEmojis(pool, query);
			return found.length === 0 ? [] : [{ id: "search", label: labels.searchResults, icon: SearchIcon, emojis: found }];
		}, [labels.searchResults, query, searching, sections]);
		const rows = React.useMemo(() => gridRowsOf(shownSections, columns), [columns, shownSections]);
		const layouts = React.useMemo(() => rowLayoutsOf(rows), [rows]);
		const getItemLayout = React.useCallback(
			(_rows: ArrayLike<GridRow> | null | undefined, index: number): RowLayout => layouts.at(index) ?? { length: ROW_HEIGHT, offset: 0, index },
			[layouts],
		);
		const chosenEmoji = React.useMemo(
			() => (data === null ? undefined : findEmoji([...customEmoji.map(normalizeCustomEmoji), ...data.emojis], value)),
			[customEmoji, data, value],
		);

		const pick = React.useCallback(
			(emoji: EmojiPickerEmoji): void => {
				playSelectionFeedback();
				onSelect({ value: getEmojiValue(emoji, skinTone), emoji, skinTone });
			},
			[onSelect, skinTone],
		);
		const chooseTone = React.useCallback(
			(tone: EmojiPickerSkinTone): void => {
				setOwnTone(tone);
				setTonesOpen(false);
				onSkinToneChange?.(tone);
			},
			[onSkinToneChange],
		);
		const toggleTones = React.useCallback((): void => {
			setTonesOpen((open: boolean): boolean => !open);
		}, []);
		const clearSearch = React.useCallback((): void => {
			setQuery("");
		}, []);
		const showSection = React.useCallback(
			(id: string): void => {
				setActiveSection(id);
				const index = rows.findIndex((row: GridRow): boolean => row.kind === "heading" && row.section === id);
				if (index >= 0) {
					listRef.current?.scrollToIndex({ index, animated: false });
				}
			},
			[rows],
		);
		// FlatList takes one `onViewableItemsChanged` for its life, so the callback reads the rows through a ref kept current after each render.
		const rowsRef = React.useRef<readonly GridRow[]>(rows);
		React.useEffect((): void => {
			rowsRef.current = rows;
		}, [rows]);
		const followScroll = React.useCallback(({ viewableItems }: { readonly viewableItems: ListViewToken[] }): void => {
			const [first] = viewableItems;
			const row = first?.index === undefined ? undefined : rowsRef.current.at(first.index);
			if (row !== undefined) {
				setActiveSection(row.section);
			}
		}, []);
		const renderRow = React.useCallback(
			({ item }: ListRenderItemInfo<GridRow>): React.JSX.Element => {
				if (item.kind === "heading") {
					return (
						<Text accessibilityRole="header" numberOfLines={1} className="font-sans-medium text-caption h-8 pt-2 text-muted-foreground">
							{item.label}
						</Text>
					);
				}
				const blanks = columns - item.emojis.length;
				return (
					<View className="h-11 flex-row">
						{item.emojis.map((emoji: EmojiPickerEmoji): React.JSX.Element => (
							<EmojiCell key={emoji.id} emoji={emoji} skinTone={skinTone} chosen={emoji.id === chosenEmoji?.id} onPick={pick} />
						))}
						{Array.from({ length: blanks }, (_blank: undefined, index: number): React.JSX.Element => (
							<View key={`blank-${String(index)}`} className="flex-1" />
						))}
					</View>
				);
			},
			[chosenEmoji?.id, columns, pick, skinTone],
		);
		const keyOf = React.useCallback((row: GridRow): string => row.key, []);
		const toneButtonState = React.useMemo(() => ({ expanded: tonesOpen }), [tonesOpen]);
		const shownActive = activeSection ?? sections.at(0)?.id ?? null;

		return (
			<View ref={ref} testID={testID} className={cn(emojiPickerPanelVariants({ size, variant }), className)}>
				{header}
				<View className="flex-row items-center gap-2">
					<View className="rounded-button min-h-11 flex-1 flex-row items-center gap-2 border border-input bg-popover px-3">
						<Icon icon={SearchIcon} size="sm" colorClassName="accent-muted-foreground" />
						<TextInput
							accessibilityLabel={labels.search}
							value={query}
							onChangeText={setQuery}
							placeholder={labels.searchPlaceholder}
							placeholderTextColorClassName="accent-muted-foreground"
							autoCapitalize="none"
							autoCorrect={false}
							autoFocus={autoFocusSearch}
							returnKeyType="search"
							className="text-body-lg flex-1 py-2.5 font-sans text-foreground"
						/>
						{searching ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={labels.clearSearch}
								onPress={clearSearch}
								className="size-8 items-center justify-center rounded-full active:bg-muted">
								<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
							</Pressable>
						) : null}
					</View>
					{hideSkinTones ? null : (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`${labels.skinTone}: ${labels.skinTones.at(skinTone) ?? ""}`}
							accessibilityState={toneButtonState}
							onPress={toggleTones}
							className={emojiPickerTabVariants({ active: tonesOpen })}>
							<Text className="text-h3">{TONE_SAMPLES.at(skinTone)}</Text>
						</Pressable>
					)}
				</View>
				{tonesOpen ? (
					<View accessibilityRole="radiogroup" accessibilityLabel={labels.skinTone} className="flex-row justify-between">
						{EMOJI_PICKER_SKIN_TONES.map((tone: EmojiPickerSkinTone): React.JSX.Element => (
							<ToneChoice key={tone} tone={tone} label={labels.skinTones.at(tone) ?? String(tone)} chosen={tone === skinTone} onChoose={chooseTone} />
						))}
					</View>
				) : null}
				{searching || data === null ? null : (
					<ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerClassName="gap-1">
						{sections.map((section: EmojiPickerSection): React.JSX.Element => (
							<CategoryTab key={section.id} section={section} active={section.id === shownActive} onPress={showSection} />
						))}
					</ScrollView>
				)}
				<View className={emojiGridVariants({ size })}>
					{data === null ? (
						<View accessibilityLabel={labels.loading} className="flex-1 items-center justify-center">
							<ActivityIndicator colorClassName="accent-muted-foreground" />
						</View>
					) : (
						<FlatList
							ref={listRef}
							data={rows}
							keyExtractor={keyOf}
							renderItem={renderRow}
							getItemLayout={getItemLayout}
							onViewableItemsChanged={followScroll}
							viewabilityConfig={VIEWABILITY_CONFIG}
							keyboardShouldPersistTaps="handled"
							ListEmptyComponent={<Text className="text-body py-6 text-center font-sans text-muted-foreground">{labels.noResults}</Text>}
						/>
					)}
				</View>
			</View>
		);
	}),
);

/* -------------------------------------------------------------------------- */
/*                                   Trigger                                  */
/* -------------------------------------------------------------------------- */

/** The button that opens the picker: the picked emoji, or a glyph while nothing is picked. */
export const emojiPickerTriggerVariants = cva("items-center justify-center border active:opacity-70", {
	variants: {
		variant: {
			outline: "border-input bg-card",
			ghost: "border-transparent",
		},
		size: {
			md: "rounded-button size-11",
			lg: "size-16 rounded-xl",
		},
	},
	defaultVariants: { variant: "outline", size: "md" },
});

const emojiPickerTriggerGlyphVariants = cva("", {
	variants: {
		size: { md: "text-h2", lg: "text-display" },
	},
	defaultVariants: { size: "md" },
});

export type EmojiPickerTriggerVariant = "outline" | "ghost";
export type EmojiPickerTriggerSize = "md" | "lg";

export interface EmojiPickerProps extends Omit<EmojiPickerPanelProps, "variant" | "size" | "className" | "testID" | "autoFocusSearch"> {
	/** The trigger's and the sheet's name ("Reaction", "Page icon"). */
	readonly label: string;
	/** The trigger's glyph while nothing is picked. Default a smiley with a plus. */
	readonly icon?: LucideIcon | undefined;
	/** Keep the sheet open after a pick (several reactions in a row). */
	readonly keepOpen?: boolean | undefined;
	readonly triggerVariant?: EmojiPickerTriggerVariant | undefined;
	readonly triggerSize?: EmojiPickerTriggerSize | undefined;
	readonly disabled?: boolean | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const EmojiPicker = React.memo(
	React.forwardRef<ViewInstance, EmojiPickerProps>(function EmojiPicker(
		{
			label,
			icon = SmilePlusIcon,
			keepOpen = false,
			triggerVariant = "outline",
			triggerSize = "md",
			disabled = false,
			className,
			testID,
			onSelect,
			value = null,
			...panelProps
		},
		ref,
	): React.JSX.Element {
		const [open, setOpen] = React.useState(false);
		const show = React.useCallback((): void => {
			setOpen(true);
		}, []);
		const hide = React.useCallback((): void => {
			setOpen(false);
		}, []);
		const select = React.useCallback(
			(selection: EmojiPickerSelection): void => {
				if (!keepOpen) {
					setOpen(false);
				}
				onSelect(selection);
			},
			[keepOpen, onSelect],
		);
		const accessibilityState = React.useMemo(() => ({ expanded: open, disabled }), [disabled, open]);
		const chosen = value !== null && panelProps.data !== null ? findEmoji(panelProps.data.emojis, value) : undefined;
		return (
			<>
				<Pressable
					ref={ref}
					accessibilityRole="button"
					accessibilityLabel={value === null ? label : `${label}: ${chosen?.label ?? value}`}
					accessibilityHint="Opens the emoji picker"
					accessibilityState={accessibilityState}
					disabled={disabled}
					onPress={show}
					testID={testID}
					className={cn(emojiPickerTriggerVariants({ variant: triggerVariant, size: triggerSize }), disabled ? "opacity-60" : undefined, className)}>
					{value === null ? (
						<Icon icon={icon} size={triggerSize === "lg" ? "lg" : "md"} colorClassName="accent-icon" />
					) : (
						<Text className={emojiPickerTriggerGlyphVariants({ size: triggerSize })}>{value}</Text>
					)}
				</Pressable>
				<BottomSheet visible={open} title={label} onClose={hide} scrollsItself size="lg" testID={testID === undefined ? undefined : `${testID}-sheet`}>
					<EmojiPickerPanel {...panelProps} value={value} onSelect={select} />
				</BottomSheet>
			</>
		);
	}),
);
