import { UI_KIT_LABELS_EN } from "./en";
import type { UiKitLanguage } from "./language-packs";
import MALAY_MESSAGES from "./messages/ms.json";
import TAMIL_MESSAGES from "./messages/ta.json";
import SIMPLIFIED_CHINESE_MESSAGES from "./messages/zh-Hans.json";
import type { UiKitLabels } from "./ui-kit-labels";
import { bindUiKitLabels } from "./ui-kit-messages";

/**
 * Every shipped pack, bound eagerly: for tests and tooling that check all languages at once. Never import this
 * from a component: the browser gets each non-English catalogue on demand (`loadUiKitLanguagePack`). `Record`
 * makes a registered language without a pack a type error.
 */
export const UI_KIT_LANGUAGE_PACKS: Readonly<Record<UiKitLanguage, UiKitLabels>> = {
	en: UI_KIT_LABELS_EN,
	ms: bindUiKitLabels("ms", MALAY_MESSAGES),
	"zh-Hans": bindUiKitLabels("zh-Hans", SIMPLIFIED_CHINESE_MESSAGES),
	ta: bindUiKitLabels("ta", TAMIL_MESSAGES),
};
