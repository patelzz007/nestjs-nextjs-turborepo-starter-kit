// ============================================
// app-messages.ts - The merchant portal's own words, one JSON catalogue per language (ADR 076)
// ============================================
// The UI kit's words are the kit's (`@workspace/ui/lib/labels`) and the sidebar's live beside its menu; everything
// else this app says lives in `messages/<language>.json`, grouped by area (`navigation`, …). English is the
// source: each other catalogue is typed against it here, so a key missing from one is a compile error, and the
// catalogue test refuses a message that takes other values than English's.

import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";

import ENGLISH from "./messages/en.json";
import MALAY from "./messages/ms.json";
import TAMIL from "./messages/ta.json";
import SIMPLIFIED_CHINESE from "./messages/zh-Hans.json";

/** One language's catalogue of this app's words: English's shape, every key required. */
export type MerchantMessages = typeof ENGLISH;

/** This app's words in every shipped language. */
export const MERCHANT_MESSAGES: Readonly<Record<UiKitLanguage, MerchantMessages>> = { en: ENGLISH, ms: MALAY, "zh-Hans": SIMPLIFIED_CHINESE, ta: TAMIL };
