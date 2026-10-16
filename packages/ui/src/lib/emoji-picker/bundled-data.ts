// The emoji data bundled with the app (emojibase-data, a dependency of this
// package) instead of fetched from a CDN at runtime: no third-party request,
// nothing for a Content-Security-Policy to allow. Each file is its own chunk,
// so a page downloads only the locale and shortcode sets its pickers ask for,
// and only when a picker first loads. The import paths are written out one
// by one because bundlers can only split chunks for paths they can see.
//
// Every file is still parsed with the same zod schemas as fetched data
// (lib/emoji-picker/data.ts): bundled or fetched, the picker trusts neither.

import { z } from "zod";

/** A JSON module of emojibase-data (an array or an object, parsed by the caller's schema). */
interface BundledJson {
	readonly default: object;
}

type BundledLoader = () => Promise<BundledJson>;

/** The locales emojibase-data ships, each bundled. */
export const EmojiPickerBundledLocaleSchema = z.enum([
	"bn",
	"da",
	"de",
	"en",
	"en-gb",
	"es",
	"es-mx",
	"et",
	"fi",
	"fr",
	"hi",
	"hu",
	"it",
	"ja",
	"ko",
	"lt",
	"ms",
	"nb",
	"nl",
	"pl",
	"pt",
	"ru",
	"sv",
	"th",
	"uk",
	"vi",
	"zh",
	"zh-hant",
]);

export type EmojiPickerBundledLocale = z.output<typeof EmojiPickerBundledLocaleSchema>;

/** `<locale>/data.json`: the emoji, their names, groups and skin tones. */
const DATA: ReadonlyMap<EmojiPickerBundledLocale, BundledLoader> = new Map<EmojiPickerBundledLocale, BundledLoader>([
	["bn", (): Promise<BundledJson> => import("emojibase-data/bn/data.json")],
	["da", (): Promise<BundledJson> => import("emojibase-data/da/data.json")],
	["de", (): Promise<BundledJson> => import("emojibase-data/de/data.json")],
	["en", (): Promise<BundledJson> => import("emojibase-data/en/data.json")],
	["en-gb", (): Promise<BundledJson> => import("emojibase-data/en-gb/data.json")],
	["es", (): Promise<BundledJson> => import("emojibase-data/es/data.json")],
	["es-mx", (): Promise<BundledJson> => import("emojibase-data/es-mx/data.json")],
	["et", (): Promise<BundledJson> => import("emojibase-data/et/data.json")],
	["fi", (): Promise<BundledJson> => import("emojibase-data/fi/data.json")],
	["fr", (): Promise<BundledJson> => import("emojibase-data/fr/data.json")],
	["hi", (): Promise<BundledJson> => import("emojibase-data/hi/data.json")],
	["hu", (): Promise<BundledJson> => import("emojibase-data/hu/data.json")],
	["it", (): Promise<BundledJson> => import("emojibase-data/it/data.json")],
	["ja", (): Promise<BundledJson> => import("emojibase-data/ja/data.json")],
	["ko", (): Promise<BundledJson> => import("emojibase-data/ko/data.json")],
	["lt", (): Promise<BundledJson> => import("emojibase-data/lt/data.json")],
	["ms", (): Promise<BundledJson> => import("emojibase-data/ms/data.json")],
	["nb", (): Promise<BundledJson> => import("emojibase-data/nb/data.json")],
	["nl", (): Promise<BundledJson> => import("emojibase-data/nl/data.json")],
	["pl", (): Promise<BundledJson> => import("emojibase-data/pl/data.json")],
	["pt", (): Promise<BundledJson> => import("emojibase-data/pt/data.json")],
	["ru", (): Promise<BundledJson> => import("emojibase-data/ru/data.json")],
	["sv", (): Promise<BundledJson> => import("emojibase-data/sv/data.json")],
	["th", (): Promise<BundledJson> => import("emojibase-data/th/data.json")],
	["uk", (): Promise<BundledJson> => import("emojibase-data/uk/data.json")],
	["vi", (): Promise<BundledJson> => import("emojibase-data/vi/data.json")],
	["zh", (): Promise<BundledJson> => import("emojibase-data/zh/data.json")],
	["zh-hant", (): Promise<BundledJson> => import("emojibase-data/zh-hant/data.json")],
]);

/** `<locale>/messages.json`: the category names in that language. */
const MESSAGES: ReadonlyMap<EmojiPickerBundledLocale, BundledLoader> = new Map<EmojiPickerBundledLocale, BundledLoader>([
	["bn", (): Promise<BundledJson> => import("emojibase-data/bn/messages.json")],
	["da", (): Promise<BundledJson> => import("emojibase-data/da/messages.json")],
	["de", (): Promise<BundledJson> => import("emojibase-data/de/messages.json")],
	["en", (): Promise<BundledJson> => import("emojibase-data/en/messages.json")],
	["en-gb", (): Promise<BundledJson> => import("emojibase-data/en-gb/messages.json")],
	["es", (): Promise<BundledJson> => import("emojibase-data/es/messages.json")],
	["es-mx", (): Promise<BundledJson> => import("emojibase-data/es-mx/messages.json")],
	["et", (): Promise<BundledJson> => import("emojibase-data/et/messages.json")],
	["fi", (): Promise<BundledJson> => import("emojibase-data/fi/messages.json")],
	["fr", (): Promise<BundledJson> => import("emojibase-data/fr/messages.json")],
	["hi", (): Promise<BundledJson> => import("emojibase-data/hi/messages.json")],
	["hu", (): Promise<BundledJson> => import("emojibase-data/hu/messages.json")],
	["it", (): Promise<BundledJson> => import("emojibase-data/it/messages.json")],
	["ja", (): Promise<BundledJson> => import("emojibase-data/ja/messages.json")],
	["ko", (): Promise<BundledJson> => import("emojibase-data/ko/messages.json")],
	["lt", (): Promise<BundledJson> => import("emojibase-data/lt/messages.json")],
	["ms", (): Promise<BundledJson> => import("emojibase-data/ms/messages.json")],
	["nb", (): Promise<BundledJson> => import("emojibase-data/nb/messages.json")],
	["nl", (): Promise<BundledJson> => import("emojibase-data/nl/messages.json")],
	["pl", (): Promise<BundledJson> => import("emojibase-data/pl/messages.json")],
	["pt", (): Promise<BundledJson> => import("emojibase-data/pt/messages.json")],
	["ru", (): Promise<BundledJson> => import("emojibase-data/ru/messages.json")],
	["sv", (): Promise<BundledJson> => import("emojibase-data/sv/messages.json")],
	["th", (): Promise<BundledJson> => import("emojibase-data/th/messages.json")],
	["uk", (): Promise<BundledJson> => import("emojibase-data/uk/messages.json")],
	["vi", (): Promise<BundledJson> => import("emojibase-data/vi/messages.json")],
	["zh", (): Promise<BundledJson> => import("emojibase-data/zh/messages.json")],
	["zh-hant", (): Promise<BundledJson> => import("emojibase-data/zh-hant/messages.json")],
]);

/** `<locale>/shortcodes/cldr.json`: CLDR annotations as shortcodes. */
const CLDR_SHORTCODES: ReadonlyMap<EmojiPickerBundledLocale, BundledLoader> = new Map<EmojiPickerBundledLocale, BundledLoader>([
	["bn", (): Promise<BundledJson> => import("emojibase-data/bn/shortcodes/cldr.json")],
	["da", (): Promise<BundledJson> => import("emojibase-data/da/shortcodes/cldr.json")],
	["de", (): Promise<BundledJson> => import("emojibase-data/de/shortcodes/cldr.json")],
	["en", (): Promise<BundledJson> => import("emojibase-data/en/shortcodes/cldr.json")],
	["en-gb", (): Promise<BundledJson> => import("emojibase-data/en-gb/shortcodes/cldr.json")],
	["es", (): Promise<BundledJson> => import("emojibase-data/es/shortcodes/cldr.json")],
	["es-mx", (): Promise<BundledJson> => import("emojibase-data/es-mx/shortcodes/cldr.json")],
	["et", (): Promise<BundledJson> => import("emojibase-data/et/shortcodes/cldr.json")],
	["fi", (): Promise<BundledJson> => import("emojibase-data/fi/shortcodes/cldr.json")],
	["fr", (): Promise<BundledJson> => import("emojibase-data/fr/shortcodes/cldr.json")],
	["hi", (): Promise<BundledJson> => import("emojibase-data/hi/shortcodes/cldr.json")],
	["hu", (): Promise<BundledJson> => import("emojibase-data/hu/shortcodes/cldr.json")],
	["it", (): Promise<BundledJson> => import("emojibase-data/it/shortcodes/cldr.json")],
	["ja", (): Promise<BundledJson> => import("emojibase-data/ja/shortcodes/cldr.json")],
	["ko", (): Promise<BundledJson> => import("emojibase-data/ko/shortcodes/cldr.json")],
	["lt", (): Promise<BundledJson> => import("emojibase-data/lt/shortcodes/cldr.json")],
	["ms", (): Promise<BundledJson> => import("emojibase-data/ms/shortcodes/cldr.json")],
	["nb", (): Promise<BundledJson> => import("emojibase-data/nb/shortcodes/cldr.json")],
	["nl", (): Promise<BundledJson> => import("emojibase-data/nl/shortcodes/cldr.json")],
	["pl", (): Promise<BundledJson> => import("emojibase-data/pl/shortcodes/cldr.json")],
	["pt", (): Promise<BundledJson> => import("emojibase-data/pt/shortcodes/cldr.json")],
	["ru", (): Promise<BundledJson> => import("emojibase-data/ru/shortcodes/cldr.json")],
	["sv", (): Promise<BundledJson> => import("emojibase-data/sv/shortcodes/cldr.json")],
	["th", (): Promise<BundledJson> => import("emojibase-data/th/shortcodes/cldr.json")],
	["uk", (): Promise<BundledJson> => import("emojibase-data/uk/shortcodes/cldr.json")],
	["vi", (): Promise<BundledJson> => import("emojibase-data/vi/shortcodes/cldr.json")],
	["zh", (): Promise<BundledJson> => import("emojibase-data/zh/shortcodes/cldr.json")],
	["zh-hant", (): Promise<BundledJson> => import("emojibase-data/zh-hant/shortcodes/cldr.json")],
]);

/** `<locale>/shortcodes/emojibase.json`: emojibase's own shortcodes. */
const EMOJIBASE_SHORTCODES: ReadonlyMap<EmojiPickerBundledLocale, BundledLoader> = new Map<EmojiPickerBundledLocale, BundledLoader>([
	["en", (): Promise<BundledJson> => import("emojibase-data/en/shortcodes/emojibase.json")],
	["en-gb", (): Promise<BundledJson> => import("emojibase-data/en-gb/shortcodes/emojibase.json")],
	["fr", (): Promise<BundledJson> => import("emojibase-data/fr/shortcodes/emojibase.json")],
	["ja", (): Promise<BundledJson> => import("emojibase-data/ja/shortcodes/emojibase.json")],
	["ru", (): Promise<BundledJson> => import("emojibase-data/ru/shortcodes/emojibase.json")],
	["sv", (): Promise<BundledJson> => import("emojibase-data/sv/shortcodes/emojibase.json")],
	["zh", (): Promise<BundledJson> => import("emojibase-data/zh/shortcodes/emojibase.json")],
]);

/** The English-only shortcode sets (GitHub and Slack's `iamcal`). */
const GITHUB_SHORTCODES: BundledLoader = (): Promise<BundledJson> => import("emojibase-data/en/shortcodes/github.json");
const IAMCAL_SHORTCODES: BundledLoader = (): Promise<BundledJson> => import("emojibase-data/en/shortcodes/iamcal.json");

export type BundledShortcodePreset = "github" | "iamcal" | "emojibase" | "cldr";

async function loadOptional(loader: BundledLoader | undefined): Promise<object | undefined> {
	return loader === undefined ? undefined : (await loader()).default;
}

/** Loads `<locale>/data.json` (every bundled locale has one; `undefined` only if the table missed it). */
export function loadBundledEmojiData(locale: EmojiPickerBundledLocale): Promise<object | undefined> {
	return loadOptional(DATA.get(locale));
}

/** Loads `<locale>/messages.json`. */
export function loadBundledEmojiMessages(locale: EmojiPickerBundledLocale): Promise<object | undefined> {
	return loadOptional(MESSAGES.get(locale));
}

/**
 * Loads one shortcode set, or `undefined` when emojibase-data has none for
 * that locale (codes then degrade, as for a missing fetched file). GitHub and
 * `iamcal` exist in English only, whatever the locale.
 */
export async function loadBundledEmojiShortcodes(locale: EmojiPickerBundledLocale, preset: BundledShortcodePreset): Promise<object | undefined> {
	switch (preset) {
		case "github":
			return (await GITHUB_SHORTCODES()).default;
		case "iamcal":
			return (await IAMCAL_SHORTCODES()).default;
		case "emojibase":
			return loadOptional(EMOJIBASE_SHORTCODES.get(locale));
		case "cldr":
			return loadOptional(CLDR_SHORTCODES.get(locale));
	}
}
