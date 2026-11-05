// ============================================
// app-languages.ts - the languages the phone app speaks (ADR 076, enhancement 5.2)
// ============================================
// The same four as the web apps (`AppLanguageSchema`, packages/shared): English, Malay, Simplified Chinese
// (Mandarin) and Tamil. Each surface's copy is a typed label pack with one value per language
// (`label-pack.ts`); a missing language, or a missing string in one, is a type error and fails the
// label-pack test.

import { AppLanguageSchema, type AppLanguage } from "@workspace/shared";

/** Every shipped language, in the order the picker lists them. */
export const APP_LANGUAGES: readonly AppLanguage[] = AppLanguageSchema.options;

/** Each language's name in itself, for the language picker (the web UI kit's own names). */
export const APP_LANGUAGE_NAMES: Readonly<Record<AppLanguage, string>> = {
	en: "English",
	ms: "Bahasa Melayu",
	"zh-Hans": "简体中文",
	ta: "தமிழ்",
};
