// The emoji picker's data and search (components/emoji-picker.tsx): the
// phone port of the web kit's lib/emoji-picker (data.ts, search.ts), with the
// same names and ranking. The picker is data-agnostic: an app imports the
// emojibase-data files it wants (`emojibase-data/en/compact.json`, its
// `messages.json` and a shortcode set) and turns them into picker data with
// `emojiPickerDataFromEmojibase`, so a bundle carries only the languages the
// app uses. Every file is parsed with zod first: the picker trusts no JSON.
// Pure, so every case is tested without rendering.

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** 0 is the default yellow; 1 to 5 run from light to dark. */
export const EMOJI_PICKER_SKIN_TONES: readonly EmojiPickerSkinTone[] = [0, 1, 2, 3, 4, 5];

export const EmojiPickerSkinToneSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export type EmojiPickerSkinTone = z.infer<typeof EmojiPickerSkinToneSchema>;

/** The Unicode categories, in their standard order. */
export const EmojiPickerCategorySchema = z.enum(["smileys", "people", "nature", "food", "travel", "activities", "objects", "symbols", "flags"]);

export type EmojiPickerCategory = z.infer<typeof EmojiPickerCategorySchema>;

export const EMOJI_PICKER_CATEGORIES: readonly EmojiPickerCategory[] = EmojiPickerCategorySchema.options;

export interface EmojiPickerEmoji {
	/** The hexcode of a Unicode emoji, like `1F44D`; the given id of a custom one. */
	readonly id: string;
	/** The native emoji at the default tone. Empty for a custom emoji. */
	readonly emoji: string;
	/** Lowercase name in the data's language, like `thumbs up`. */
	readonly label: string;
	/** Search keywords in the data's language. */
	readonly tags: readonly string[];
	/** Without colons, like `+1` and `thumbsup`. */
	readonly shortcodes: readonly string[];
	/** A category key, or a custom category id. */
	readonly category: string;
	/** The five toned forms, light to dark, when the emoji takes a skin tone. */
	readonly skins?: readonly string[] | undefined;
	/** Image URL of a custom emoji. */
	readonly src?: string | undefined;
}

export interface EmojiPickerCustomEmoji {
	readonly id: string;
	readonly label: string;
	/** Image URL. A square image of 64 px or more stays sharp at every size. */
	readonly src: string;
	readonly tags?: readonly string[] | undefined;
	/** Defaults to the id. The first one makes the value: `:partyparrot:`. */
	readonly shortcodes?: readonly string[] | undefined;
	/** A custom category id. Defaults to `custom`. */
	readonly category?: string | undefined;
}

export interface EmojiPickerData {
	readonly locale: string;
	readonly emojis: readonly EmojiPickerEmoji[];
	/** Category names in the data's language. */
	readonly categories: Partial<Record<EmojiPickerCategory, string>>;
}

/** What a pick hands back. */
export interface EmojiPickerSelection {
	/** The native emoji with the skin tone applied, or `:shortcode:` for a custom emoji. */
	readonly value: string;
	readonly emoji: EmojiPickerEmoji;
	readonly skinTone: EmojiPickerSkinTone;
}

/* -------------------------------------------------------------------------- */
/*                        emojibase-data wire schemas                         */
/* -------------------------------------------------------------------------- */

/** A list of strings, or one string; anything else reads as no strings. */
const StringListSchema = z
	.union([
		z.string().transform((value: string): string[] => [value]),
		z.array(z.string().nullable().catch(null)).transform((values: (string | null)[]): string[] => values.filter((value): value is string => value !== null)),
	])
	.catch([]);

const CompactSkinSchema = z.object({ hexcode: z.string(), unicode: z.string() }).nullable().catch(null);

const CompactEmojiSchema = z
	.object({
		label: z.string().catch(""),
		hexcode: z.string(),
		unicode: z.string(),
		tags: StringListSchema.optional(),
		group: z.int().nonnegative().optional(),
		order: z.number().catch(0).optional(),
		skins: z.array(CompactSkinSchema).catch([]).optional(),
	})
	.nullable()
	.catch(null);

/** emojibase's `<locale>/compact.json`. Entries that cannot be read become `null` and are dropped, never trusted. */
export const EmojibaseCompactSchema = z.array(CompactEmojiSchema);

/** emojibase's `<locale>/messages.json`: the category names in that language. */
export const EmojibaseMessagesSchema = z
	.object({
		groups: z.array(z.object({ key: z.string(), message: z.string() }).nullable().catch(null)).catch([]),
	})
	.catch({ groups: [] });

/** emojibase's `<locale>/shortcodes/<preset>.json`: hexcode → one code or several. */
export const EmojibaseShortcodesSchema = z.record(z.string(), StringListSchema).catch({});

/* emojibase group numbers. Group 2 holds the bare tone and hair components. */
const GROUPS: readonly (EmojiPickerCategory | null)[] = ["smileys", "people", null, "nature", "food", "travel", "activities", "objects", "symbols", "flags"];

const MESSAGE_GROUPS: ReadonlyMap<string, EmojiPickerCategory> = new Map<string, EmojiPickerCategory>([
	["smileys-emotion", "smileys"],
	["people-body", "people"],
	["animals-nature", "nature"],
	["food-drink", "food"],
	["travel-places", "travel"],
	["activities", "activities"],
	["objects", "objects"],
	["symbols", "symbols"],
	["flags", "flags"],
]);

/** The skin tone modifiers, light (1) to dark (5), as they end a toned emoji's hexcode. */
const TONE_MODIFIERS: readonly string[] = ["1F3FB", "1F3FC", "1F3FD", "1F3FE", "1F3FF"];

export interface EmojibaseFiles {
	/** The data's language, for capitalizing category names. Default `en`. */
	readonly locale?: string | undefined;
	/** `<locale>/compact.json`. */
	readonly compact: object;
	/** `<locale>/messages.json`: category names. */
	readonly messages?: object | undefined;
	/** Shortcode sets (`en/shortcodes/github.json`): merged, the first set's codes first. */
	readonly shortcodes?: readonly object[] | undefined;
}

/** Upper-cases the first character, in the data's language. */
function capitalize(text: string, locale: string): string {
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function mergeShortcodes(files: readonly object[]): Map<string, string[]> {
	const codes = new Map<string, string[]>();
	files.forEach((file: object): void => {
		Object.entries(EmojibaseShortcodesSchema.parse(file)).forEach(([hexcode, value]: [string, string[]]): void => {
			const known = codes.get(hexcode) ?? [];
			codes.set(hexcode, [...known, ...value.filter((code: string): boolean => !known.includes(code))]);
		});
	});
	return codes;
}

/* Mixed tones in one sequence (two people, two tones) are left out: one tone
   choice cannot reach them. Only a complete 1…5 set of single-tone forms counts. */
function readSkins(raw: readonly z.output<typeof CompactSkinSchema>[] | undefined): readonly string[] | undefined {
	const skins = TONE_MODIFIERS.map((modifier: string): string | undefined => {
		const matches = (raw ?? []).filter((skin): boolean => skin?.hexcode.includes(modifier) === true);
		const only = matches.length === 1 ? (matches.at(0) ?? null) : null;
		const single = only !== null && TONE_MODIFIERS.every((other: string): boolean => other === modifier || !only.hexcode.includes(other));
		return single ? only.unicode : undefined;
	});
	return skins.every((skin: string | undefined): skin is string => skin !== undefined) ? skins : undefined;
}

interface OrderedEmoji {
	readonly order: number;
	readonly emoji: EmojiPickerEmoji;
}

/** Turns emojibase-data's compact file, messages and shortcode sets into picker data, parsing each first. */
export function emojiPickerDataFromEmojibase(files: EmojibaseFiles): EmojiPickerData {
	const locale = files.locale ?? "en";
	const codes = mergeShortcodes(files.shortcodes ?? []);
	const ordered: OrderedEmoji[] = [];
	EmojibaseCompactSchema.parse(files.compact).forEach((item): void => {
		const category = item?.group === undefined ? null : (GROUPS.at(item.group) ?? null);
		if (item === null || category === null) {
			return;
		}
		ordered.push({
			order: item.order ?? 0,
			emoji: {
				id: item.hexcode,
				emoji: item.unicode,
				label: item.label,
				tags: item.tags ?? [],
				shortcodes: codes.get(item.hexcode) ?? [],
				category,
				skins: readSkins(item.skins),
			},
		});
	});
	const emojis = ordered.sort((left: OrderedEmoji, right: OrderedEmoji): number => left.order - right.order).map((entry: OrderedEmoji): EmojiPickerEmoji => entry.emoji);
	const categories: Partial<Record<EmojiPickerCategory, string>> = {};
	EmojibaseMessagesSchema.parse(files.messages ?? {}).groups.forEach((group): void => {
		const key = group === null || group.message === "" ? undefined : MESSAGE_GROUPS.get(group.key);
		if (group !== null && key !== undefined) {
			categories[key] = capitalize(group.message, locale);
		}
	});
	return { locale, emojis, categories };
}

/* -------------------------------------------------------------------------- */
/*                                   Values                                   */
/* -------------------------------------------------------------------------- */

/** The category a custom emoji lands in when it names none. */
export const EMOJI_PICKER_CUSTOM_CATEGORY = "custom";

/* emojibase writes the fully qualified form (thumbs up with VS16), while stored
   text often carries the bare one, so values compare without the selector. */
const VARIATION_SELECTOR = /️/gu;

/** A value without its emoji variation selector (VS16), for comparison. */
export function bareEmojiValue(text: string): string {
	return text.replace(VARIATION_SELECTOR, "");
}

/** The value a pick stores: the toned native emoji, or `:shortcode:` for a custom one. */
export function getEmojiValue(emoji: EmojiPickerEmoji, skinTone: EmojiPickerSkinTone = 0): string {
	if (emoji.src !== undefined) {
		const [shortcode = emoji.id] = emoji.shortcodes;
		return `:${shortcode}:`;
	}
	return skinTone === 0 ? emoji.emoji : (emoji.skins?.at(skinTone - 1) ?? emoji.emoji);
}

/** Whether a stored value is this emoji: any tone, with or without VS16. */
export function isEmojiValue(emoji: EmojiPickerEmoji, value: string): boolean {
	const target = bareEmojiValue(value);
	return bareEmojiValue(getEmojiValue(emoji)) === target || (emoji.skins ?? []).some((skin: string): boolean => bareEmojiValue(skin) === target);
}

/** Finds the emoji a value came from, any tone, or a custom emoji's `:shortcode:`. */
export function findEmoji(emojis: readonly EmojiPickerEmoji[], value: string | null | undefined): EmojiPickerEmoji | undefined {
	if (value === null || value === undefined || value === "") {
		return undefined;
	}
	return emojis.find((emoji: EmojiPickerEmoji): boolean => isEmojiValue(emoji, value));
}

/** A custom emoji as picker data: no native glyph, its id as the shortcode unless it names some. */
export function normalizeCustomEmoji(emoji: EmojiPickerCustomEmoji): EmojiPickerEmoji {
	return {
		id: emoji.id,
		emoji: "",
		label: emoji.label,
		tags: emoji.tags ?? [],
		shortcodes: emoji.shortcodes !== undefined && emoji.shortcodes.length > 0 ? emoji.shortcodes : [emoji.id],
		category: emoji.category ?? EMOJI_PICKER_CUSTOM_CATEGORY,
		src: emoji.src,
	};
}

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

const COMBINING_MARKS = /\p{M}/gu;
const HIRAGANA = /[ぁ-ゖ]/gu;
/** Hiragana → katakana is a fixed code-point offset. */
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/** Accents drop, and hiragana reads as katakana, so ねこ finds ネコ. */
export function foldSearchText(text: string): string {
	return text
		.normalize("NFKD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(HIRAGANA, (kana: string): string => String.fromCharCode((kana.codePointAt(0) ?? 0) + HIRAGANA_TO_KATAKANA_OFFSET));
}

interface SearchIndex {
	readonly label: string;
	readonly words: readonly string[];
	readonly tags: readonly string[];
	readonly shortcodes: readonly string[];
}

const WORD_SEPARATORS = /[\s:,-]+/u;
const WHITESPACE = /\s+/u;
const COLONS = /:/gu;

const searchIndexCache = new WeakMap<EmojiPickerEmoji, SearchIndex>();

function searchIndexOf(emoji: EmojiPickerEmoji): SearchIndex {
	const cached = searchIndexCache.get(emoji);
	if (cached !== undefined) {
		return cached;
	}
	const label = foldSearchText(emoji.label);
	const index: SearchIndex = {
		label,
		words: label.split(WORD_SEPARATORS).filter((word: string): boolean => word !== ""),
		tags: emoji.tags.map(foldSearchText),
		shortcodes: emoji.shortcodes.map(foldSearchText),
	};
	searchIndexCache.set(emoji, index);
	return index;
}

/** How well one field matches one term. Exact beats a prefix beats a substring; a name or shortcode beats a keyword. */
const SEARCH_SCORE = {
	exactValue: 1000,
	exactName: 100,
	shortcodePrefix: 80,
	namePrefix: 75,
	wordPrefix: 70,
	exactTag: 60,
	tagPrefix: 50,
	nameSubstring: 35,
	shortcodeSubstring: 30,
	tagSubstring: 20,
} satisfies Record<string, number>;

function scoreField(field: string, term: string, exact: number, prefix: number, substring: number): number {
	if (field === term) {
		return exact;
	}
	if (field.startsWith(term)) {
		return prefix;
	}
	return field.includes(term) ? substring : 0;
}

/** The best field match for one term. */
function scoreTerm(index: SearchIndex, term: string): number {
	const scores: number[] = [
		index.label === term ? SEARCH_SCORE.exactName : 0,
		index.label.startsWith(term) ? SEARCH_SCORE.namePrefix : 0,
		...index.shortcodes.map((code: string): number => scoreField(code, term, SEARCH_SCORE.exactName, SEARCH_SCORE.shortcodePrefix, SEARCH_SCORE.shortcodeSubstring)),
		...index.words.map((word: string): number => (word.startsWith(term) ? SEARCH_SCORE.wordPrefix : 0)),
		...index.tags.map((tag: string): number => scoreField(tag, term, SEARCH_SCORE.exactTag, SEARCH_SCORE.tagPrefix, SEARCH_SCORE.tagSubstring)),
	];
	const best = Math.max(...scores);
	return best === 0 && index.label.includes(term) ? SEARCH_SCORE.nameSubstring : best;
}

function scoreEmoji(emoji: EmojiPickerEmoji, terms: readonly string[], exact: string): number {
	if (exact !== "" && isEmojiValue(emoji, exact)) {
		return SEARCH_SCORE.exactValue;
	}
	const index = searchIndexOf(emoji);
	let score = 0;
	for (const term of terms) {
		const termScore = scoreTerm(index, term);
		if (termScore === 0) {
			return 0;
		}
		score += termScore;
	}
	return score;
}

export interface SearchEmojisOptions {
	readonly limit?: number | undefined;
}

interface ScoredEmoji {
	readonly emoji: EmojiPickerEmoji;
	readonly score: number;
	readonly at: number;
}

/**
 * Ranks emoji against a query. Every word must match the name, a keyword or a
 * shortcode; colons around a shortcode are ignored, so `:thumbsup:` works.
 * Ties keep the input order.
 */
export function searchEmojis(emojis: readonly EmojiPickerEmoji[], query: string, options: SearchEmojisOptions = {}): readonly EmojiPickerEmoji[] {
	const terms = foldSearchText(query)
		.replace(COLONS, " ")
		.split(WHITESPACE)
		.filter((term: string): boolean => term !== "");
	if (terms.length === 0) {
		return [];
	}
	const exact = query.trim();
	const scored: ScoredEmoji[] = [];
	emojis.forEach((emoji: EmojiPickerEmoji, at: number): void => {
		const score = scoreEmoji(emoji, terms, exact);
		if (score > 0) {
			scored.push({ emoji, score, at });
		}
	});
	scored.sort((left: ScoredEmoji, right: ScoredEmoji): number => right.score - left.score || left.at - right.at);
	const ranked = scored.map((entry: ScoredEmoji): EmojiPickerEmoji => entry.emoji);
	return options.limit === undefined ? ranked : ranked.slice(0, options.limit);
}

/* -------------------------------------------------------------------------- */
/*                                 Shortcodes                                 */
/* -------------------------------------------------------------------------- */

/** A shortcode being typed at the end of the text: a colon, then two or more code characters. */
const OPEN_SHORTCODE = /(?:^|\s):(?<code>[\w+-]{2,})$/u;
/** A closed shortcode anywhere in the text. */
const CLOSED_SHORTCODE = /:(?<code>[\w+-]+):/gu;

/** The shortcode being typed at the end of `text` (`"nice :thu"` → `"thu"`), or `null`. */
export function openShortcodeOf(text: string): string | null {
	return OPEN_SHORTCODE.exec(text)?.groups?.code ?? null;
}

/** `text` with its trailing open shortcode (`:thu`) replaced by `value`. */
export function completeShortcode(text: string, value: string): string {
	const code = openShortcodeOf(text);
	return code === null ? text : `${text.slice(0, text.length - code.length - 1)}${value}`;
}

/** `text` with every closed shortcode that names a Unicode emoji (`:tada:`) swapped for that emoji; unknown codes stay. */
export function replaceShortcodes(text: string, emojis: readonly EmojiPickerEmoji[]): string {
	return text.replace(CLOSED_SHORTCODE, (whole: string, code: string): string => {
		const emoji = emojis.find((candidate: EmojiPickerEmoji): boolean => candidate.src === undefined && candidate.shortcodes.includes(code));
		return emoji === undefined ? whole : emoji.emoji;
	});
}
