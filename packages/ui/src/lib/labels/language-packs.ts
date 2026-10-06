import { z } from "zod";

import { UI_KIT_LABELS_EN } from "./en";
import type { UiKitLabels } from "./ui-kit-labels";

/** The languages the UI kit ships a complete label pack for. Add a language here and in `UI_KIT_LANGUAGE_PACKS`. */
export const UI_KIT_LANGUAGES: readonly ["en"] = ["en"];

export const UiKitLanguageSchema = z.enum(UI_KIT_LANGUAGES);

export type UiKitLanguage = z.infer<typeof UiKitLanguageSchema>;

/** Every shipped pack by language — `Record` makes a registered language without a pack a type error. */
export const UI_KIT_LANGUAGE_PACKS: Readonly<Record<UiKitLanguage, UiKitLabels>> = {
	en: UI_KIT_LABELS_EN,
};
