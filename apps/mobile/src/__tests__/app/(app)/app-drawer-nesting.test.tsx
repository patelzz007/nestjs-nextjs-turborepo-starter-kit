import { fireEvent, screen, within } from "expo-router/testing-library";

import { ok, stubApi } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../test/app-harness";
import { profileJson, sessionPermissionsJson, userJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import AppTabsLayout from "../../../app/(app)/_layout";
import HomeScreen from "../../../app/(app)/index";
import * as SettingsLayoutModule from "../../../app/(app)/settings/_layout";

// A nested menu in place of the app's: a branch two levels deep holding Security and Devices, so the
// drawer's folding is driven through the real panel (the shipped menu is flat today).
jest.mock("../../../features/navigation/mobile-drawer-items.json", () => ({
	header: { title: "Starter", subtitle: "Mobile" },
	sections: [
		{
			title: "Tabs",
			labelKey: "tabs",
			items: [
				{ title: "Home", labelKey: "index", url: "/", icon: "House" },
				{ title: "Settings", labelKey: "settings", url: "/settings", icon: "Settings" },
			],
		},
		{
			title: "Account",
			labelKey: "account",
			color: "blue",
			items: [
				{
					title: "Sign-in",
					labelKey: "sign-in",
					url: "",
					icon: "LockKeyhole",
					children: [
						{ title: "Security", labelKey: "security", url: "/settings/security", icon: "ShieldCheck" },
						{
							title: "Places",
							labelKey: "places",
							url: "",
							icon: "Smartphone",
							children: [{ title: "Devices", labelKey: "devices", url: "/settings/devices", icon: "Smartphone" }],
						},
					],
				},
			],
		},
	],
	bottomItems: [],
}));

const SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/settings/_layout": SettingsLayoutModule,
	"(app)/settings/index": markerScreen("settings screen"),
	"(app)/settings/security": markerScreen("security screen"),
	"(app)/settings/devices": markerScreen("devices screen"),
};

async function openDrawerAt(url: string): Promise<ReturnType<typeof within>> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, SCREENS, url);
	await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
	return within(screen.getByTestId("app-drawer-panel"));
}

describe("app drawer: nested entries", () => {
	beforeEach(() => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()), "GET /auth/permissions": ok(sessionPermissionsJson()) });
	});

	it("folds a branch open level by level, then opens the screen at the bottom", async () => {
		const drawer = await openDrawerAt("/");

		expect(drawer.getByRole("button", { name: "Sign-in" })).toBeCollapsed();
		expect(drawer.queryByRole("button", { name: "Security" })).toBeNull();

		await fireEvent.press(drawer.getByRole("button", { name: "Sign-in" }));
		expect(drawer.getByRole("button", { name: "Sign-in" })).toBeExpanded();
		// Its rows sit in a submenu: stepped in, with the vertical line down their left (as on the web).
		expect(drawer.getByTestId("app-drawer-sign-in-rows")).toBeOnTheScreen();
		expect(drawer.getByRole("button", { name: "Security" })).toBeOnTheScreen();
		expect(drawer.queryByRole("button", { name: "Signed-in devices" })).toBeNull();

		await fireEvent.press(drawer.getByRole("button", { name: "Places" }));
		await fireEvent.press(drawer.getByRole("button", { name: "Signed-in devices" }));
		expect(await screen.findByText("devices screen")).toBeOnTheScreen();
	});

	it("folds a branch shut again", async () => {
		const drawer = await openDrawerAt("/");

		await fireEvent.press(drawer.getByRole("button", { name: "Sign-in" }));
		await fireEvent.press(drawer.getByRole("button", { name: "Sign-in" }));

		expect(drawer.getByRole("button", { name: "Sign-in" })).toBeCollapsed();
		expect(drawer.queryByRole("button", { name: "Security" })).toBeNull();
	});
});
