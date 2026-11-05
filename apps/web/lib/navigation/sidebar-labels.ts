// ============================================
// The web sidebar in Malay, Simplified Chinese and Tamil (enhancement 5.12)
// ============================================
// The menu's JSON keeps each entry's English title and its `labelKey`; the other shipped languages' words are one
// JSON file each in `sidebar-messages/` (ADR 076). Malay's file is the pack's shape: a key missing from Chinese or
// Tamil is a compile error, and the label-pack test checks the files cover exactly the keys the menu uses.
//
// Machine-assisted drafts, like the UI kit's catalogues (5.2 phase 1): have a native reader check them before
// they reach customers.

import type { SidebarLabelPack } from "@workspace/client/lib/sidebar/sidebar-menu-labels";

import MALAY from "./sidebar-messages/ms.json";
import TAMIL from "./sidebar-messages/ta.json";
import SIMPLIFIED_CHINESE from "./sidebar-messages/zh-Hans.json";

export type UserSidebarLabelKey = keyof typeof MALAY;

const ZH_HANS: Readonly<Record<UserSidebarLabelKey, string>> = SIMPLIFIED_CHINESE;
const TA: Readonly<Record<UserSidebarLabelKey, string>> = TAMIL;

/** The web sidebar's words in every shipped language but English (the menu's own titles). */
export const USER_SIDEBAR_LABELS: SidebarLabelPack<UserSidebarLabelKey> = { ms: MALAY, "zh-Hans": ZH_HANS, ta: TA };
