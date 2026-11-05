import ENGLISH_MESSAGES from "./messages/en.json";
import type { UiKitLabels } from "./ui-kit-labels";
import { bindUiKitLabels } from "./ui-kit-messages";

/**
 * The English language pack: every UI kit string, from `messages/en.json` (the source every other language's
 * catalogue is checked against). Components never fall back to it: an app opts in at its root
 * (`<UiKitLanguageProvider language="en">`). A new language is one more catalogue in `messages/`, registered in
 * `language-packs.ts`.
 */
export const UI_KIT_LABELS_EN: UiKitLabels = bindUiKitLabels("en", ENGLISH_MESSAGES);
