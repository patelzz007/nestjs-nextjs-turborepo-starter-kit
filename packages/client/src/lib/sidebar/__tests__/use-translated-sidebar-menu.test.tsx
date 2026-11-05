// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { loadUiKitLanguagePack } from "@workspace/ui/lib/labels/language-packs";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { compileMenu } from "../sidebar-menu-compile";
import { useTranslatedSidebarMenu, type SidebarLabelPack } from "../sidebar-menu-labels";

const MENU = compileMenu({
	header: { title: "Acme Inc.", subtitle: "Admin Panel" },
	sections: [{ title: "Main", labelKey: "main", items: [{ title: "Users", labelKey: "main.users", url: "/users" }] }],
	bottomItems: [],
});
const PACK: SidebarLabelPack<"main" | "main.users"> = {
	ms: { main: "Utama", "main.users": "Pengguna" },
	"zh-Hans": { main: "主要", "main.users": "用户" },
	ta: { main: "முதன்மை", "main.users": "பயனர்கள்" },
};

describe("useTranslatedSidebarMenu (enhancement 5.12)", () => {
	it("shows the menu in the language on screen", async () => {
		// The Malay UI-kit pack loads on demand; loaded first, the provider renders at once.
		await loadUiKitLanguagePack("ms");
		const { result } = renderHook(() => useTranslatedSidebarMenu(MENU, PACK), {
			wrapper: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <UiKitLanguageProvider language="ms">{children}</UiKitLanguageProvider>,
		});
		expect(result.current.sections.map((section) => [section.key, section.title, section.items.map((item) => item.title)])).toStrictEqual([["Main", "Utama", ["Pengguna"]]]);
	});

	it("keeps English outside a language provider", () => {
		const { result } = renderHook(() => useTranslatedSidebarMenu(MENU, PACK));
		expect(result.current).toBe(MENU);
	});
});
