import { isStringPrimitive } from "@workspace/shared";
import type * as React from "react";
import { z } from "zod";

import { EmojiPickerBundledLocaleSchema, loadBundledEmojiData, loadBundledEmojiMessages, loadBundledEmojiShortcodes } from "@workspace/ui/lib/emoji-picker/bundled-data";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** 0 is the default yellow; 1 to 5 run from light to dark. */
export const EMOJI_PICKER_SKIN_TONES: readonly [0, 1, 2, 3, 4, 5] = [0, 1, 2, 3, 4, 5];

export const EmojiPickerSkinToneSchema = z.literal(EMOJI_PICKER_SKIN_TONES);

export type EmojiPickerSkinTone = z.infer<typeof EmojiPickerSkinToneSchema>;

/** The Unicode categories, in their standard order. */
export const EMOJI_PICKER_CATEGORIES: readonly ["smileys", "people", "nature", "food", "travel", "activities", "objects", "symbols", "flags"] = [
	"smileys",
	"people",
	"nature",
	"food",
	"travel",
	"activities",
	"objects",
	"symbols",
	"flags",
];

export const EmojiPickerCategorySchema = z.enum(EMOJI_PICKER_CATEGORIES);

export type EmojiPickerCategory = z.infer<typeof EmojiPickerCategorySchema>;

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
	/** The Emoji version that added it. 0 for a custom emoji. */
	readonly version: number;
	/** The five toned forms, light to dark, when the emoji takes a skin tone. */
	readonly skins?: readonly string[] | undefined;
	/** The Emoji version that added the tones, when later than the emoji's own. */
	readonly skinVersion?: number | undefined;
	/** Image URL of a custom emoji. */
	readonly src?: string | undefined;
}

export interface EmojiPickerCustomEmoji {
	readonly id: string;
	readonly label: string;
	/** Image URL. A square image of 64px or more stays sharp at every size. */
	readonly src: string;
	readonly tags?: readonly string[];
	/** Defaults to the id. The first one makes the value: `:partyparrot:`. */
	readonly shortcodes?: readonly string[];
	/** A `customCategories` id. Defaults to `custom`. */
	readonly category?: string;
}

export interface EmojiPickerCustomCategory {
	readonly id: string;
	readonly label: string;
	/** Tab icon. Defaults to a sparkle. */
	readonly icon?: React.ReactNode;
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

/** One frequently used emoji, by base id. `count` orders the frequent mode. */
export interface EmojiPickerRecentEntry {
	readonly id: string;
	readonly count: number;
}

/** GitHub and Slack (`iamcal`) codes are English only; `emojibase` and `cldr` follow the locale. */
export const EmojiPickerShortcodePresetSchema = z.enum(["github", "iamcal", "emojibase", "cldr"]);

export type EmojiPickerShortcodePreset = z.infer<typeof EmojiPickerShortcodePresetSchema>;

export type EmojiPickerShortcodes = EmojiPickerShortcodePreset | readonly EmojiPickerShortcodePreset[] | false;

export type EmojiPickerDataStatus = "idle" | "loading" | "ready" | "error";

/* -------------------------------------------------------------------------- */
/*                        emojibase-data wire schemas                         */
/* -------------------------------------------------------------------------- */

/**
 * The cache key of the data bundled with the app (emojibase-data, a dependency
 * of this package — lib/emoji-picker/bundled-data.ts), used when no `url` is
 * given. Nothing is fetched from a third party by default.
 */
const BUNDLED_SOURCE = "bundled";

/** The data language when the caller names none. */
export const DEFAULT_EMOJI_PICKER_LOCALE = "en";

/** The shortcode set searched and shown when the caller names none. */
export const DEFAULT_EMOJI_PICKER_SHORTCODES: EmojiPickerShortcodePreset = "github";

/** The highest emojibase skin tone (5 = dark); tones 1…5 make a complete set. */
const SKIN_TONE_COUNT = 5;

/** A list of strings, or one string; anything else reads as no strings. */
const StringListSchema = z
	.union([
		z.string().transform((value: string): string[] => [value]),
		z.array(z.string().nullable().catch(null)).transform((values: (string | null)[]): string[] => values.filter((value): value is string => value !== null)),
	])
	.catch([]);

const FiniteNumberSchema = z.number().catch(0);

const EmojibaseSkinSchema = z
	.object({
		emoji: z.string(),
		tone: z.int().min(1).max(SKIN_TONE_COUNT),
		version: FiniteNumberSchema.optional(),
	})
	.nullable()
	.catch(null);

const EmojibaseEmojiSchema = z
	.object({
		label: z.string().catch(""),
		hexcode: z.string(),
		emoji: z.string(),
		tags: StringListSchema.optional(),
		group: z.int().nonnegative(),
		order: FiniteNumberSchema.optional(),
		version: FiniteNumberSchema.optional(),
		skins: z.array(EmojibaseSkinSchema).catch([]).optional(),
	})
	.nullable()
	.catch(null);

/** emojibase's `<locale>/data.json`. Entries that cannot be read become `null` and are dropped, never trusted. */
export const EmojibaseDataSchema = z.array(EmojibaseEmojiSchema);

export type EmojibaseData = z.output<typeof EmojibaseDataSchema>;

/** emojibase's `<locale>/messages.json`: the category names in that language. */
export const EmojibaseMessagesSchema = z
	.object({
		groups: z.array(z.object({ key: z.string(), message: z.string() }).nullable().catch(null)).catch([]),
	})
	.catch({ groups: [] });

export type EmojibaseMessages = z.output<typeof EmojibaseMessagesSchema>;

/** emojibase's `<locale>/shortcodes/<preset>.json`: hexcode → one code or several. */
export const EmojibaseShortcodesSchema = z.record(z.string(), StringListSchema).catch({});

export type EmojibaseShortcodes = z.output<typeof EmojibaseShortcodesSchema>;

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

const ENGLISH_ONLY_SHORTCODES: ReadonlySet<EmojiPickerShortcodePreset> = new Set<EmojiPickerShortcodePreset>(["github", "iamcal"]);

/* The locale lands in a URL path, so only a BCP 47 shape gets through. */
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu;

export interface NormalizeEmojibaseOptions {
	readonly locale?: string;
	readonly messages?: EmojibaseMessages | undefined;
	readonly shortcodes?: readonly (EmojibaseShortcodes | undefined)[];
}

/** Upper-cases the first character, in the data's language. */
function capitalize(text: string, locale: string): string {
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function mergeShortcodes(maps: readonly (EmojibaseShortcodes | undefined)[]): Map<string, string[]> {
	const codes = new Map<string, string[]>();
	for (const map of maps) {
		if (map === undefined) {
			continue;
		}
		for (const [hexcode, value] of Object.entries(map)) {
			const known = codes.get(hexcode) ?? [];
			const added = value.filter((code: string): boolean => !known.includes(code));
			codes.set(hexcode, [...known, ...added]);
		}
	}
	return codes;
}

interface ReadSkins {
	readonly skins: readonly string[] | null;
	readonly skinVersion: number;
}

/* Mixed tones in one sequence (two people, two tones) are left out: a single
   tone choice cannot reach them. Only a complete 1…5 set counts. */
function readSkins(raw: z.output<typeof EmojibaseSkinSchema>[] | undefined): ReadSkins {
	const byTone = new Map<number, string>();
	let skinVersion = 0;
	for (const skin of raw ?? []) {
		if (skin === null) {
			continue;
		}
		byTone.set(skin.tone, skin.emoji);
		skinVersion = Math.max(skinVersion, skin.version ?? 0);
	}
	const skins: string[] = [];
	for (let tone = 1; tone <= SKIN_TONE_COUNT; tone += 1) {
		const skin = byTone.get(tone);
		if (skin === undefined) {
			return { skins: null, skinVersion: 0 };
		}
		skins.push(skin);
	}
	return { skins, skinVersion };
}

interface OrderedEmoji {
	readonly order: number;
	readonly emoji: EmojiPickerEmoji;
}

/**
 * Turns emojibase's parsed `data.json`, `messages.json` and shortcode files
 * into picker data. Parse the raw JSON with `EmojibaseDataSchema` (and the
 * messages / shortcode schemas) first.
 */
export function normalizeEmojibaseData(raw: EmojibaseData, options: NormalizeEmojibaseOptions = {}): EmojiPickerData {
	const locale = options.locale ?? DEFAULT_EMOJI_PICKER_LOCALE;
	const codes = mergeShortcodes(options.shortcodes ?? []);
	const sorted: OrderedEmoji[] = [];
	for (const item of raw) {
		if (item === null) {
			continue;
		}
		const category = GROUPS[item.group] ?? null;
		if (category === null) {
			continue;
		}
		const version = item.version ?? 0;
		const { skins, skinVersion } = readSkins(item.skins);
		sorted.push({
			order: item.order ?? 0,
			emoji: {
				id: item.hexcode,
				emoji: item.emoji,
				label: item.label,
				tags: item.tags ?? [],
				shortcodes: codes.get(item.hexcode) ?? [],
				category,
				version,
				skins: skins ?? undefined,
				skinVersion: skins !== null && skinVersion > version ? skinVersion : undefined,
			},
		});
	}
	const emojis = [...sorted].sort((left: OrderedEmoji, right: OrderedEmoji): number => left.order - right.order).map((entry: OrderedEmoji): EmojiPickerEmoji => entry.emoji);

	const categories: Partial<Record<EmojiPickerCategory, string>> = {};
	for (const group of options.messages?.groups ?? []) {
		if (group === null || group.message === "") {
			continue;
		}
		const key = MESSAGE_GROUPS.get(group.key);
		if (key !== undefined) {
			categories[key] = capitalize(group.message, locale);
		}
	}
	return { locale, emojis, categories };
}

/* -------------------------------------------------------------------------- */
/*                                   Loading                                  */
/* -------------------------------------------------------------------------- */

export interface EmojiPickerDataOptions {
	/** An emojibase locale: `en`, `de`, `ja`, `pt`, `zh-hant` and 23 more. */
	readonly locale?: string | undefined;
	/** Base URL of a self-hosted emojibase-data copy. Omitted: the data bundled with the app (no network request). */
	readonly url?: string | undefined;
	readonly shortcodes?: EmojiPickerShortcodes | undefined;
}

export class EmojiPickerDataError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "EmojiPickerDataError";
	}
}

const dataCache = new Map<string, Promise<EmojiPickerData>>();
/* Settled loads, read while rendering so a second picker never flashes a
   loading state for data the page already has. */
const dataReady = new Map<string, EmojiPickerData>();

/** The shortcode presets a `shortcodes` setting asks for. */
export function shortcodePresetsOf(shortcodes: EmojiPickerShortcodes | undefined): readonly EmojiPickerShortcodePreset[] {
	if (shortcodes === false) {
		return [];
	}
	const setting = shortcodes ?? DEFAULT_EMOJI_PICKER_SHORTCODES;
	return isStringPrimitive(setting) ? [setting] : setting;
}

/** The cache key of one URL, locale and shortcode set. */
export function emojiPickerDataKey(options: EmojiPickerDataOptions): string {
	return [options.url ?? BUNDLED_SOURCE, options.locale ?? DEFAULT_EMOJI_PICKER_LOCALE, shortcodePresetsOf(options.shortcodes).join("+")].join("|");
}

/** Settled data for these options, if the page has loaded it already. */
export function readLoadedEmojiPickerData(options: EmojiPickerDataOptions): EmojiPickerData | undefined {
	return dataReady.get(emojiPickerDataKey(options));
}

const TRAILING_SLASHES = /\/+$/u;

async function fetchJson<T>(base: string, path: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetch(`${base}/${path}`);
	if (!response.ok) {
		throw new EmojiPickerDataError(`${String(response.status)} for ${path}`);
	}
	return schema.parse(await response.json());
}

/* Only the emoji themselves are required; names and codes degrade. */
async function fetchOptionalJson<T>(base: string, path: string, schema: z.ZodType<T>): Promise<T | undefined> {
	try {
		return await fetchJson(base, path, schema);
	} catch {
		return undefined;
	}
}

/* An optional bundled file, parsed like a fetched one: unreadable or absent reads as nothing. */
function parseOptional<T>(value: object | undefined, schema: z.ZodType<T>): T | undefined {
	if (value === undefined) {
		return undefined;
	}
	const parsed = schema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

async function loadBundledOptional<T>(load: () => Promise<object | undefined>, schema: z.ZodType<T>): Promise<T | undefined> {
	try {
		return parseOptional(await load(), schema);
	} catch {
		return undefined;
	}
}

/** The data bundled with the app: every file its own chunk, downloaded only now. */
async function loadBundledEmojiPickerData(locale: string, presets: readonly EmojiPickerShortcodePreset[]): Promise<EmojiPickerData> {
	const bundledLocale = EmojiPickerBundledLocaleSchema.safeParse(locale);
	if (!bundledLocale.success) {
		throw new EmojiPickerDataError(`No bundled emoji data for locale: ${locale}`);
	}
	const { data: localeKey } = bundledLocale;
	const [raw, messages, shortcodes] = await Promise.all([
		loadBundledEmojiData(localeKey).then((value: object | undefined): EmojibaseData => {
			if (value === undefined) {
				throw new EmojiPickerDataError(`No bundled emoji data for locale: ${locale}`);
			}
			return EmojibaseDataSchema.parse(value);
		}),
		loadBundledOptional((): Promise<object | undefined> => loadBundledEmojiMessages(localeKey), EmojibaseMessagesSchema),
		Promise.all(
			presets.map((preset: EmojiPickerShortcodePreset): Promise<EmojibaseShortcodes | undefined> =>
				loadBundledOptional((): Promise<object | undefined> => loadBundledEmojiShortcodes(localeKey, preset), EmojibaseShortcodesSchema),
			),
		),
	]);
	return normalizeEmojibaseData(raw, { locale, messages, shortcodes });
}

async function fetchEmojiPickerData(options: EmojiPickerDataOptions): Promise<EmojiPickerData> {
	const locale = options.locale ?? DEFAULT_EMOJI_PICKER_LOCALE;
	if (!LOCALE_PATTERN.test(locale)) {
		throw new EmojiPickerDataError(`Invalid emoji locale: ${locale}`);
	}
	if (options.url === undefined) {
		return loadBundledEmojiPickerData(locale, shortcodePresetsOf(options.shortcodes));
	}
	const base = options.url.replace(TRAILING_SLASHES, "");
	const [raw, messages, shortcodes] = await Promise.all([
		fetchJson(base, `${locale}/data.json`, EmojibaseDataSchema),
		fetchOptionalJson(base, `${locale}/messages.json`, EmojibaseMessagesSchema),
		Promise.all(
			shortcodePresetsOf(options.shortcodes).map((preset: EmojiPickerShortcodePreset): Promise<EmojibaseShortcodes | undefined> =>
				fetchOptionalJson(base, `${ENGLISH_ONLY_SHORTCODES.has(preset) ? DEFAULT_EMOJI_PICKER_LOCALE : locale}/shortcodes/${preset}.json`, EmojibaseShortcodesSchema),
			),
		),
	]);
	return normalizeEmojibaseData(raw, { locale, messages, shortcodes });
}

/**
 * Loads and normalizes emojibase data once per source (bundled, or a
 * self-hosted `url`), locale and shortcode set; every picker on the page
 * shares the load. A failed load is
 * forgotten, so the next call retries.
 */
export function loadEmojiPickerData(options: EmojiPickerDataOptions = {}): Promise<EmojiPickerData> {
	const key = emojiPickerDataKey(options);
	const cached = dataCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const pending = fetchEmojiPickerData(options)
		.then((data: EmojiPickerData): EmojiPickerData => {
			dataReady.set(key, data);
			return data;
		})
		.catch((error: unknown): EmojiPickerData => {
			dataCache.delete(key);
			throw error;
		});
	dataCache.set(key, pending);
	return pending;
}

/** Forgets every load. For tests. */
export function resetEmojiPickerDataCache(): void {
	dataCache.clear();
	dataReady.clear();
}
