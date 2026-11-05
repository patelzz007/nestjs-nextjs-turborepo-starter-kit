import { describe, expect, it } from "vitest";

import { compileMenu } from "../sidebar-menu-compile";
import { sidebarLabelKeys, translateSidebarMenu, type SidebarLabelPack } from "../sidebar-menu-labels";
import type { SidebarMenuData } from "../sidebar-menu-schema";

const MENU: SidebarMenuData = {
	header: { title: "Acme Inc.", subtitle: "Admin Panel" },
	sections: [
		{
			title: "Main",
			labelKey: "main",
			items: [{ title: "Users", labelKey: "main.users", url: "/users", children: [{ title: "All users", labelKey: "main.users.all", url: "/users" }] }],
		},
	],
	bottomItems: [{ title: "Account", labelKey: "bottom.account", url: "/account" }],
};

type Key = "main" | "main.users" | "main.users.all" | "bottom.account";
const PACK: SidebarLabelPack<Key> = {
	ms: { main: "Utama", "main.users": "Pengguna", "main.users.all": "Semua pengguna", "bottom.account": "Akaun" },
	"zh-Hans": { main: "主要", "main.users": "用户", "main.users.all": "所有用户", "bottom.account": "账户" },
	ta: { main: "முதன்மை", "main.users": "பயனர்கள்", "main.users.all": "அனைத்து பயனர்கள்", "bottom.account": "கணக்கு" },
};

describe("translateSidebarMenu (enhancement 5.12)", () => {
	it("translates every section and item, children too, keeping ids and the section's English key", () => {
		const compiled = compileMenu(MENU);
		const malay = translateSidebarMenu(compiled, PACK, "ms");
		const [main] = malay.sections;
		expect(main).toMatchObject({
			title: "Utama",
			key: "Main",
			items: [{ id: "main-users", title: "Pengguna", children: [{ id: "main-users-all-users", title: "Semua pengguna" }] }],
		});
		expect(malay.bottomItems).toMatchObject([{ title: "Akaun" }]);
		expect(malay.header).toStrictEqual(compiled.header);
	});

	it("leaves English as it is, and an unknown key on its English title", () => {
		const compiled = compileMenu(MENU);
		expect(translateSidebarMenu(compiled, PACK, "en")).toBe(compiled);
		const partial = { ...PACK, ta: { ...PACK.ta, "bottom.account": "" } };
		const withUnknown = compileMenu({ ...MENU, bottomItems: [{ title: "Help", labelKey: "bottom.help", url: "/help" }] });
		expect(translateSidebarMenu(withUnknown, partial, "ta").bottomItems).toMatchObject([{ title: "Help" }]);
	});
});

describe("sidebarLabelKeys", () => {
	it("lists every key the menu uses, in menu order", () => {
		expect(sidebarLabelKeys(MENU)).toStrictEqual(["main", "main.users", "main.users.all", "bottom.account"]);
	});
});
