import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import * as Localization from "expo-localization";

import { ok, stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../../test/app-harness";
import { userJson } from "../../../../../test/fixtures";
import { testAccessToken } from "../../../../../test/jwt";
import { memorySecureStore } from "../../../../../test/secure-store-memory";
import AppTabsLayout from "../../../../app/(app)/_layout";
import LanguageScreen from "../../../../app/(app)/settings/language";
import SettingsScreen from "../../../../app/(app)/settings/index";
import * as SettingsLayoutModule from "../../../../app/(app)/settings/_layout";
import { savePreferences } from "../../../../features/preferences/persistence";
import { DEFAULT_PREFERENCES } from "../../../../features/preferences/state";

/** The signed-in person's profile as the API sends it, saved in `language`. */
function profileIn(language: string): { readonly data: Readonly<Record<string, string | number | null>> } {
	return {
		data: { id: "6f1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d21", email: "member@example.com", fullName: "Alex Morgan", avatar: null, language, version: 3, createdAt: 0, updatedAt: 0 },
	};
}

async function renderSignedIn(screens: Parameters<typeof renderInApp>[1], url: string): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({ savePreferences }, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, screens, url);
	return runtime;
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("Language (ADR 076, 5.2)", () => {
	it("follows the phone's language until one is chosen", async () => {
		const [phoneLocale] = Localization.getLocales();
		jest.spyOn(Localization, "useLocales").mockReturnValue([{ ...phoneLocale, languageCode: "ms", regionCode: "MY", languageScriptCode: null }]);
		stubApi({});
		await renderSignedIn({ "settings/language": LanguageScreen }, "/settings/language");

		expect(screen.getByRole("radio", { name: "Bahasa Melayu" })).toBeChecked();
		expect(screen.getByText("Pilih bahasa yang digunakan aplikasi pada peranti ini.")).toBeOnTheScreen();
	});

	it("applies the choice at once, says so in the new language, keeps it and saves it on the profile", async () => {
		const api = stubApi({ "PUT /auth/profile/language": ok(profileIn("zh-Hans").data) });
		const runtime = await renderSignedIn({ "settings/language": LanguageScreen }, "/settings/language");

		expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
		await fireEvent.press(screen.getByRole("radio", { name: "简体中文" }));

		expect(screen.getByRole("radio", { name: "简体中文" })).toBeChecked();
		expect(within(screen.getByTestId("app-toast")).getByText("语言已设为简体中文。")).toBeOnTheScreen();
		expect(screen.getByText("选择应用在此设备上使用的语言。")).toBeOnTheScreen();
		expect(runtime.preferencesStore.getState().language).toBe("zh-Hans");
		// Kept on this device: written to Secure Store (a waitFor callback must be synchronous — an async one never settles the check).
		await waitFor(() => {
			expect(memorySecureStore.peek("prefs.language")).toBe(JSON.stringify("zh-Hans"));
		});
		await waitFor(() => {
			expect(api.callsTo("PUT /auth/profile/language").map((call) => call.body)).toEqual([JSON.stringify({ language: "zh-Hans" })]);
		});
	});

	it("does nothing when the language on screen is chosen again", async () => {
		const api = stubApi({});
		await renderSignedIn({ "settings/language": LanguageScreen }, "/settings/language");

		await fireEvent.press(screen.getByRole("radio", { name: "English" }));

		expect(screen.queryByTestId("app-toast")).toBeNull();
		expect(api.callsTo("PUT /auth/profile/language")).toHaveLength(0);
	});

	it("shows the language on the Settings row and opens the Language screen", async () => {
		stubApi({});
		await renderSignedIn({ "settings/index": SettingsScreen, "settings/language": markerScreen("language screen") }, "/settings");

		await fireEvent.press(screen.getByRole("button", { name: /Language/ }));

		expect(await screen.findByText("language screen")).toBeOnTheScreen();
	});
});

describe("the saved language after sign-in (ADR 076 §3)", () => {
	const TABS = {
		"(app)/_layout": AppTabsLayout,
		"(app)/index": markerScreen("home"),
		"(app)/settings/_layout": SettingsLayoutModule,
		"(app)/settings/index": SettingsScreen,
	};

	it("applies the profile's language on a device that hasn't chosen one, and the tabs follow", async () => {
		stubApi({ "GET /auth/profile": ok(profileIn("ta").data), "GET /auth/me": ok(userJson()) });
		const runtime = await renderSignedIn(TABS, "/settings");

		await waitFor(() => {
			expect(runtime.preferencesStore.getState().language).toBe("ta");
		});
		expect(await screen.findByTestId("tab-settings")).toHaveTextContent(/அமைப்புகள்/);
	});

	it("keeps this device's own choice over the saved one", async () => {
		stubApi({ "GET /auth/profile": ok(profileIn("ta").data), "GET /auth/me": ok(userJson()) });
		memorySecureStore.seed("prefs.language", JSON.stringify("ms"));
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		runtime.preferencesStore.dispatch({ type: "[ Preferences ] Restored", preferences: { ...DEFAULT_PREFERENCES, language: "ms" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await renderInApp(runtime, TABS, "/settings");

		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(runtime.preferencesStore.getState().language).toBe("ms");
		expect(await screen.findByTestId("tab-settings")).toHaveTextContent(/Tetapan/);
	});
});
