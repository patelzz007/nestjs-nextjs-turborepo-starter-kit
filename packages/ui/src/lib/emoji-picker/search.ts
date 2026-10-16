import type { EmojiPickerCustomEmoji, EmojiPickerEmoji, EmojiPickerSkinTone } from "./data";

/* -------------------------------------------------------------------------- */
/*                                   Values                                   */
/* -------------------------------------------------------------------------- */

/** The category a custom emoji lands in when it names none. */
export const EMOJI_PICKER_CUSTOM_CATEGORY = "custom";

/* emojibase writes the fully qualified form (thumbs up with VS16), while
   stored text and older data often carry the bare one, so values compare
   without the selector. */
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
	if (skinTone === 0) {
		return emoji.emoji;
	}
	return emoji.skins?.[skinTone - 1] ?? emoji.emoji;
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
		version: 0,
		src: emoji.src,
	};
}

/* Country flags (two regional indicators) and subdivision flags (black flag
   plus tag characters): what Windows draws as letters. */
const REGIONAL_FLAG = /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0060}-\u{E007F}]+)$/u;

/** Whether the text is a country or subdivision flag. */
export function isRegionalFlag(text: string): boolean {
	return REGIONAL_FLAG.test(text);
}

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

const COMBINING_MARKS = /\p{M}/gu;
const HIRAGANA = /[ぁ-ゖ]/gu;
/** Hiragana → katakana is a fixed code-point offset. */
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/* Accents drop, and hiragana reads as katakana, so ねこ finds ネコ. */
export function foldSearchText(text: string): string {
	return text
		.normalize("NFKD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(HIRAGANA, (kana: string): string => String.fromCharCode(kana.charCodeAt(0) + HIRAGANA_TO_KATAKANA_OFFSET));
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

/* Best field match for one term. */
function scoreTerm(index: SearchIndex, term: string): number {
	const scores: number[] = [index.label === term ? SEARCH_SCORE.exactName : 0, index.label.startsWith(term) ? SEARCH_SCORE.namePrefix : 0];
	for (const code of index.shortcodes) {
		scores.push(scoreField(code, term, SEARCH_SCORE.exactName, SEARCH_SCORE.shortcodePrefix, SEARCH_SCORE.shortcodeSubstring));
	}
	for (const word of index.words) {
		scores.push(word.startsWith(term) ? SEARCH_SCORE.wordPrefix : 0);
	}
	for (const tag of index.tags) {
		scores.push(scoreField(tag, term, SEARCH_SCORE.exactTag, SEARCH_SCORE.tagPrefix, SEARCH_SCORE.tagSubstring));
	}
	const best = Math.max(...scores);
	if (best === 0 && index.label.includes(term)) {
		return SEARCH_SCORE.nameSubstring;
	}
	return best;
}

export interface SearchEmojisOptions {
	readonly limit?: number;
}

interface ScoredEmoji {
	readonly emoji: EmojiPickerEmoji;
	readonly score: number;
	readonly at: number;
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

/**
 * Ranks emoji against a query. Every word must match the name, a keyword or
 * a shortcode; colons around a shortcode are ignored, so `:thumbsup:` works.
 * Ties keep the input order.
 */
export function searchEmojis(emojis: readonly EmojiPickerEmoji[], query: string, options: SearchEmojisOptions = {}): EmojiPickerEmoji[] {
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
