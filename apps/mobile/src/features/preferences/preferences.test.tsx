import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { memorySecureStore } from "../../../test/secure-store-memory";
import { preferencesActions } from "./actions";
import { PreferencesStoreProvider, useAppLockEnabled, useAppLockTimeoutMs, usePreferencesCommands, usePreferencesSnapshot, useThemePreference } from "./facade";
import { loadPreferences, savePreferences } from "./persistence";
import { preferencesReducer } from "./reducer";
import { DEFAULT_PREFERENCES } from "./state";
import { createPreferencesStore, type PreferencesStore, type PreferencesStoreDependencies } from "./store";

function dependencies(overrides: Partial<PreferencesStoreDependencies> = {}): PreferencesStoreDependencies {
	return { applyTheme: jest.fn(), save: savePreferences, onSaveFailed: jest.fn(), ...overrides };
}

describe("preferencesReducer", () => {
	it("defaults to System, lock off, 60 s (§9.7, §11.2)", () => {
		expect(DEFAULT_PREFERENCES).toEqual({ theme: "system", appLock: { enabled: false, timeoutMs: 60_000 } });
	});

	it("applies each change", () => {
		const changed = [preferencesActions.themeChanged("dark"), preferencesActions.appLockTurnedOn(), preferencesActions.appLockTimeoutChanged(0)].reduce(
			preferencesReducer,
			DEFAULT_PREFERENCES,
		);
		expect(changed).toEqual({ theme: "dark", appLock: { enabled: true, timeoutMs: 0 } });
		expect(preferencesReducer(changed, preferencesActions.appLockTurnedOff()).appLock).toEqual({ enabled: false, timeoutMs: 0 });
		expect(preferencesReducer(changed, preferencesActions.restored(DEFAULT_PREFERENCES))).toEqual(DEFAULT_PREFERENCES);
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
		await expect(loadPreferences()).resolves.toEqual({ theme: "dark", appLock: { enabled: false, timeoutMs: 60_000 } });
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

		await expect(loadPreferences()).resolves.toEqual({ theme: "dark", appLock: { enabled: true, timeoutMs: 60_000 } });
		expect(memorySecureStore.peek("prefs.appLock.timeoutMs")).toBe("60000");
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
