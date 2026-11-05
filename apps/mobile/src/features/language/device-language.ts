// ============================================
// device-language.ts - the phone's own language, as one the app ships (ADR 076 §3)
// ============================================
// Until the person chooses a language in Settings, the app follows the phone: the first of the
// phone's preferred languages that the app ships, else English. Chinese written in Traditional
// characters (a `Hant` script, or Taiwan, Hong Kong and Macau without a script) is not Simplified
// Chinese, so it is skipped rather than shown in the other script.

import type { AppLanguage } from "@workspace/shared";

/** What the choice needs from one of the phone's preferred locales (expo-localization's `Locale`). */
export interface DeviceLocale {
	/** ISO 639 language code: `en`, `ms`, `zh`, `ta`, … */
	readonly languageCode: string | null;
	/** ISO 15924 script code, when the locale names one: `Hans`, `Hant`, … */
	readonly languageScriptCode: string | null;
	/** ISO 3166 region code: `MY`, `SG`, `TW`, … */
	readonly regionCode: string | null;
}

/** The language each shipped language code means. */
const SHIPPED_LANGUAGE_BY_CODE: ReadonlyMap<string, AppLanguage> = new Map<string, AppLanguage>([
	["en", "en"],
	["ms", "ms"],
	["zh", "zh-Hans"],
	["ta", "ta"],
]);

/** The script code of Traditional Chinese. */
const TRADITIONAL_CHINESE_SCRIPT = "Hant";

/** Regions whose Chinese is written in Traditional characters when the locale names no script. */
const TRADITIONAL_CHINESE_REGIONS: ReadonlySet<string> = new Set(["TW", "HK", "MO"]);

/** The app's language when nothing on the phone matches. */
const FALLBACK_LANGUAGE: AppLanguage = "en";

function isTraditionalChinese(locale: DeviceLocale): boolean {
	if (locale.languageScriptCode !== null) {
		return locale.languageScriptCode === TRADITIONAL_CHINESE_SCRIPT;
	}
	return locale.regionCode !== null && TRADITIONAL_CHINESE_REGIONS.has(locale.regionCode);
}

function shippedLanguageOf(locale: DeviceLocale): AppLanguage | null {
	const language = locale.languageCode === null ? undefined : SHIPPED_LANGUAGE_BY_CODE.get(locale.languageCode);
	if (language === undefined) {
		return null;
	}
	return language === "zh-Hans" && isTraditionalChinese(locale) ? null : language;
}

/** The first of the phone's preferred locales (most preferred first) that the app ships, else English. */
export function deviceLanguageOf(locales: readonly DeviceLocale[]): AppLanguage {
	for (const locale of locales) {
		const language = shippedLanguageOf(locale);
		if (language !== null) {
			return language;
		}
	}
	return FALLBACK_LANGUAGE;
}
