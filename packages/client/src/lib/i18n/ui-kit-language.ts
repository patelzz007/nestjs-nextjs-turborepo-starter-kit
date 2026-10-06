import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";

/**
 * The language every web, merchant and admin screen's UI kit copy is in — the
 * one switch. Each app's root layout mounts
 * `<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>`; a new language
 * is a pack in `@workspace/ui/lib/labels` plus a change here (or, per user, a
 * value resolved from their preference in the layout).
 */
export const PLATFORM_UI_KIT_LANGUAGE: UiKitLanguage = "en";
