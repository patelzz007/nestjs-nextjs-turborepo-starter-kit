import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { memorySecureStore } from "../../../../test/secure-store-memory";
import { preferencesActions } from "../actions";
import { PreferencesStoreProvider, useAppLockEnabled, useAppLockTimeoutMs, usePreferencesCommands, usePreferencesSnapshot, useThemePreference } from "../facade";
import { loadPreferences, savePreferences } from "../persistence";
import { preferencesReducer } from "../reducer";
import { DEFAULT_PREFERENCES } from "../state";
import { createPreferencesStore, type PreferencesStore, type PreferencesStoreDependencies } from "../store";

function dependencies(overrides: Partial<PreferencesStoreDependencies> = {}): PreferencesStoreDependencies {
	return { applyTheme: jest.fn(), save: savePreferences, onSaveFailed: jest.fn(), ...overrides };
}

describe("preferencesReducer", () => {
	it("defaults to System, lock off, 60 s, onboarding not seen yet (§9.7, §11.2, ADR 041)", () => {
		expect(DEFAULT_PREFERENCES).toEqual({
			theme: "system",
			drawerStyle: "centred-ink",
			appLock: { enabled: false, timeoutMs: 60_000 },
			language: null,
			onboardingCompleted: false,
		});
	});

	it("applies each change", () => {
		const changed = [
			preferencesActions.themeChanged("dark"),
			preferencesActions.appLockTurnedOn(),
			preferencesActions.appLockTimeoutChanged(0),
			preferencesActions.languageChanged("ms"),
			preferencesActions.onboardingCompleted(),
		].reduce(preferencesReducer, DEFAULT_PREFERENCES);
		expect(changed).toEqual({ theme: "dark", drawerStyle: "centred-ink", appLock: { enabled: true, timeoutMs: 0 }, language: "ms", onboardingCompleted: true });
		expect(preferencesReducer(changed, preferencesActions.reset())).toEqual(DEFAULT_PREFERENCES);
		expect(preferencesReducer(changed, preferencesActions.appLockTurnedOff()).appLock).toEqual({ enabled: false, timeoutMs: 0 });
		expect(preferencesReducer(changed, preferencesActions.restored(DEFAULT_PREFERENCES))).toEqual(DEFAULT_PREFERENCES);
	});
});

describe("resetting the preferences", () => {
	it("applies the default theme and saves the defaults, so a restart stays reset", () => {
		const applyTheme = jest.fn();
		const save = jest.fn((): Promise<void> => Promise.resolve());
		const store = createPreferencesStore({ applyTheme, save, onSaveFailed: jest.fn() });
		store.dispatch(preferencesActions.themeChanged("harbour"));
		store.dispatch(preferencesActions.drawerStyleChanged("wash-cards"));

		store.dispatch(preferencesActions.reset());

		expect(store.getState()).toEqual(DEFAULT_PREFERENCES);
		expect(applyTheme).toHaveBeenLastCalledWith("system");
		expect(save).toHaveBeenLastCalledWith(DEFAULT_PREFERENCES);
	});
});

describe("the drawer's look", () => {
	it("starts on the centred ink drawer and follows the choice", () => {
		expect(DEFAULT_PREFERENCES.drawerStyle).toBe("centred-ink");
		expect(preferencesReducer(DEFAULT_PREFERENCES, preferencesActions.drawerStyleChanged("wash-cards")).drawerStyle).toBe("wash-cards");
	});

	it("survives a restart", async () => {
		await savePreferences({ ...DEFAULT_PREFERENCES, drawerStyle: "ink-cards" });

		await expect(loadPreferences()).resolves.toMatchObject({ drawerStyle: "ink-cards" });
	});
});

describe("theme persistence (§10.9)", () => {
	it("applies the restored theme before anything is rendered, without writing it back", () => {
		const applyTheme = jest.fn();
		const store = createPreferencesStore(dependencies({ applyTheme }));

		store.dispatch(preferencesActions.restored({ ...DEFAULT_PREFERENCES, theme: "light" }));

		expect(applyTheme).toHaveBeenCalledWith("light");
		expect(memorySecureStore.setItemAsync).not.toHaveBeenCalled();
	});

	it("applies a changed theme at once and saves it in Secure Store", async () => {
		const applyTheme = jest.fn();
		const store = createPreferencesStore(dependencies({ applyTheme }));

		store.dispatch(preferencesActions.themeChanged("dark"));

		expect(applyTheme).toHaveBeenLastCalledWith("dark");
		await waitFor(() => {
			expect(memorySecureStore.peek("prefs.theme")).toBe(JSON.stringify("dark"));
		});
		await expect(loadPreferences()).resolves.toEqual({
			theme: "dark",
			drawerStyle: "centred-ink",
			appLock: { enabled: false, timeoutMs: 60_000 },
			language: null,
			onboardingCompleted: false,
		});
	});

	it("reports a failed save and keeps the preference for this run", async () => {
		const onSaveFailed = jest.fn();
		const store = createPreferencesStore(dependencies({ save: (): Promise<void> => Promise.reject(new Error("keychain")), onSaveFailed }));

		store.dispatch(preferencesActions.themeChanged("light"));

		await waitFor(() => {
			expect(onSaveFailed).toHaveBeenCalledWith(expect.any(Error));
		});
		expect(store.getState().theme).toBe("light");
	});
});

describe("loadPreferences", () => {
	it("falls back to the defaults for absent values", async () => {
		await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
	});

	it("reads stored values and repairs corrupt ones", async () => {
		memorySecureStore.seed("prefs.theme", JSON.stringify("dark"));
		memorySecureStore.seed("prefs.appLock.enabled", JSON.stringify(true));
		memorySecureStore.seed("prefs.appLock.timeoutMs", "not-json");

		await expect(loadPreferences()).resolves.toEqual({
			theme: "dark",
			drawerStyle: "centred-ink",
			appLock: { enabled: true, timeoutMs: 60_000 },
			language: null,
			onboardingCompleted: false,
		});
		expect(memorySecureStore.peek("prefs.appLock.timeoutMs")).toBe("60000");
	});

	it("reads the chosen language, and treats a missing, corrupt or unreadable one as no choice (ADR 076)", async () => {
		memorySecureStore.seed("prefs.language", JSON.stringify("ta"));
		await expect(loadPreferences()).resolves.toMatchObject({ language: "ta" });

		memorySecureStore.seed("prefs.language", JSON.stringify("fr"));
		await expect(loadPreferences()).resolves.toMatchObject({ language: null });

		memorySecureStore.getItemAsync.mockImplementation((key: string): Promise<string | null> =>
			key === "prefs.language" ? Promise.reject(new Error("keychain")) : Promise.resolve(null),
		);
		await expect(loadPreferences()).resolves.toMatchObject({ language: null });
	});
});

describe("savePreferences — the language (ADR 076)", () => {
	it("keeps a chosen language and removes it when there is none", async () => {
		await savePreferences({ ...DEFAULT_PREFERENCES, language: "zh-Hans" });
		expect(memorySecureStore.peek("prefs.language")).toBe(JSON.stringify("zh-Hans"));

		await savePreferences(DEFAULT_PREFERENCES);
		expect(memorySecureStore.peek("prefs.language")).toBeNull();
	});
});

describe("preferences facade", () => {
	it("reads and changes the preferences", async () => {
		const store: PreferencesStore = createPreferencesStore(dependencies());
		function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
			return <PreferencesStoreProvider store={store}>{children}</PreferencesStoreProvider>;
		}
		const { result } = await renderHook(
			() => ({
				theme: useThemePreference(),
				enabled: useAppLockEnabled(),
				timeoutMs: useAppLockTimeoutMs(),
				commands: usePreferencesCommands(),
				snapshot: usePreferencesSnapshot(),
			}),
			{ wrapper: Wrapper },
		);

		await act((): void => {
			result.current.commands.themeChanged("light");
			result.current.commands.appLockTurnedOn();
			result.current.commands.appLockTimeoutChanged(300_000);
		});
		expect(result.current).toMatchObject({ theme: "light", enabled: true, timeoutMs: 300_000 });

		await act((): void => {
			result.current.commands.appLockTurnedOff();
		});
		expect(result.current.snapshot().appLock.enabled).toBe(false);
	});
});
