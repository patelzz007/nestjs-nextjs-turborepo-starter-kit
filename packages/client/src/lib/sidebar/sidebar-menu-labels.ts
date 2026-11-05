// ============================================
// The sidebar in the reader's language (enhancement 5.12)
// ============================================
// `sidebar-menu.json` stays each app's one menu source: every section and item carries its English title and
// a `labelKey` beside it. An app's label pack gives the other shipped languages for those keys, typed so a
// missing word in one language is a compile error (ADR 076). The menu is translated after it is compiled, so
// item ids and a person's saved section order (keyed by the English titles) are the same in every language.

import { useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import * as React from "react";

import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "./sidebar-menu-schema";

/** The languages a pack translates into: every shipped one but English, which the JSON's titles already are. */
export type SidebarTranslatedLanguage = Exclude<UiKitLanguage, "en">;

/** One app's sidebar words: for each translated language, the text of every label key. */
export type SidebarLabelPack<Key extends string> = Readonly<Record<SidebarTranslatedLanguage, Readonly<Record<Key, string>>>>;

/** The words for one language, looked up by key (English: none, the titles are shown as they are). */
type SidebarWords = Readonly<Record<string, string>>;

function translateItems(items: readonly CompiledSidebarMenuItem[], words: SidebarWords): readonly CompiledSidebarMenuItem[] {
	return items.map((item): CompiledSidebarMenuItem => ({
		...item,
		// A key the pack doesn't know keeps its English title (the label-pack tests keep every key covered).
		title: words[item.labelKey] ?? item.title,
		children: item.children === undefined ? undefined : translateItems(item.children, words),
	}));
}

/** The menu with every title in `language`; English returns the menu unchanged. */
export function translateSidebarMenu<Key extends string>(menu: CompiledSidebarMenuData, pack: SidebarLabelPack<Key>, language: UiKitLanguage): CompiledSidebarMenuData {
	if (language === "en") {
		return menu;
	}
	const words: SidebarWords = pack[language];
	return {
		header: menu.header,
		sections: menu.sections.map((section) => ({ ...section, title: words[section.labelKey] ?? section.title, items: translateItems(section.items, words) })),
		bottomItems: translateItems(menu.bottomItems, words),
	};
}

/** The menu in the language on screen (English outside a language provider). */
export function useTranslatedSidebarMenu<Key extends string>(menu: CompiledSidebarMenuData, pack: SidebarLabelPack<Key>): CompiledSidebarMenuData {
	const language = useUiKitLanguage()?.language ?? "en";
	return React.useMemo((): CompiledSidebarMenuData => translateSidebarMenu(menu, pack, language), [language, menu, pack]);
}

function itemKeys(items: readonly SidebarMenuItem[]): readonly string[] {
	return items.flatMap((item): readonly string[] => [item.labelKey, ...itemKeys(item.children ?? [])]);
}

/** Every label key a menu uses, in menu order: what an app's label pack must cover exactly. */
export function sidebarLabelKeys(menu: SidebarMenuData): readonly string[] {
	return [...menu.sections.flatMap((section): readonly string[] => [section.labelKey, ...itemKeys(section.items)]), ...itemKeys(menu.bottomItems)];
}
