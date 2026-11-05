import { z } from "zod";

import { UI_KIT_LABELS_EN } from "./en";
import type { UiKitLabels } from "./ui-kit-labels";
import { bindUiKitLabels } from "./ui-kit-messages";

/**
 * The languages the UI kit ships a complete catalogue for (ADR 076): English, Malay, Simplified Chinese
 * (Mandarin) and Tamil, as BCP 47 tags. Add a language here, as `messages/<tag>.json`, in
 * `UI_KIT_LANGUAGE_PACK_LOADERS`, in `UI_KIT_FORMAT_LOCALES` and in `all-language-packs.ts`.
 */
export const UI_KIT_LANGUAGES: readonly ["en", "ms", "zh-Hans", "ta"] = ["en", "ms", "zh-Hans", "ta"];

export const UiKitLanguageSchema = z.enum(UI_KIT_LANGUAGES);

export type UiKitLanguage = z.infer<typeof UiKitLanguageSchema>;

/**
 * How each pack reaches the browser. English, the default and the fallback, is in the main bundle; every
 * other language's catalogue is its own chunk, downloaded only by someone who reads that language (a catalogue
 * is ~710 messages, so shipping all four to everyone cost every page's first load). Each is bound to its labels
 * as it arrives; passing it to `bindUiKitLabels` is what types it against English's catalogue, so a key missing
 * from one fails the build. `Record` makes a registered language without a loader a type error.
 */
export const UI_KIT_LANGUAGE_PACK_LOADERS: Readonly<Record<UiKitLanguage, () => Promise<UiKitLabels>>> = {
	en: loadEnglish,
	ms: loadMalay,
	"zh-Hans": loadSimplifiedChinese,
	ta: loadTamil,
};

function loadEnglish(): Promise<UiKitLabels> {
	return Promise.resolve(UI_KIT_LABELS_EN);
}

async function loadMalay(): Promise<UiKitLabels> {
	return bindUiKitLabels("ms", (await import("./messages/ms.json")).default);
}

async function loadSimplifiedChinese(): Promise<UiKitLabels> {
	return bindUiKitLabels("zh-Hans", (await import("./messages/zh-Hans.json")).default);
}

async function loadTamil(): Promise<UiKitLabels> {
	return bindUiKitLabels("ta", (await import("./messages/ta.json")).default);
}

const loadingPacks = new Map<UiKitLanguage, Promise<UiKitLabels>>();
const readyPacks = new Map<UiKitLanguage, UiKitLabels>([["en", UI_KIT_LABELS_EN]]);

/** The pack for `language`, loaded once per page: the same promise every time, as `React.use` needs. */
export function loadUiKitLanguagePack(language: UiKitLanguage): Promise<UiKitLabels> {
	const loading = loadingPacks.get(language);
	if (loading !== undefined) {
		return loading;
	}
	const started = UI_KIT_LANGUAGE_PACK_LOADERS[language]().then((pack: UiKitLabels): UiKitLabels => {
		readyPacks.set(language, pack);
		return pack;
	});
	loadingPacks.set(language, started);
	return started;
}

/** The pack for `language` if it has already loaded (English always has), so a render needn't wait for it. */
export function readyUiKitLanguagePack(language: UiKitLanguage): UiKitLabels | undefined {
	return readyPacks.get(language);
}

/** Each language's name in itself, for a language picker. */
export const UI_KIT_LANGUAGE_NAMES: Readonly<Record<UiKitLanguage, string>> = {
	en: "English",
	ms: "Bahasa Melayu",
	"zh-Hans": "简体中文",
	ta: "தமிழ்",
};
