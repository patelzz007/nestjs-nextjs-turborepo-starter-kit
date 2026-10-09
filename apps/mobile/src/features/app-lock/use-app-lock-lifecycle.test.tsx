import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as React from "react";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";

import { memorySecureStore } from "../../../test/secure-store-memory";
import { preferencesActions } from "../preferences/actions";
import { PreferencesStoreProvider } from "../preferences/facade";
import { DEFAULT_PREFERENCES } from "../preferences/state";
import { createPreferencesStore, type PreferencesStore } from "../preferences/store";
import { sessionActions } from "../session/actions";
import { SessionStoreProvider } from "../session/facade";
import { createSessionStore, type SessionStore } from "../session/store";
import { useAppLockLifecycle } from "./use-app-lock-lifecycle";

jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
	supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
	authenticateAsync: jest.fn(),
}));

interface Harness {
	readonly session: SessionStore;
	readonly preferences: PreferencesStore;
	readonly emit: (state: AppStateStatus) => void;
	readonly result: { readonly current: { readonly isCoverVisible: boolean } };
	readonly resetAppLock: jest.Mock;
	readonly clock: { now: number };
}

async function setup(lockEnabled: boolean, timeoutMs: 0 | 60_000 | 300_000 = 60_000): Promise<Harness> {
	let listener: ((state: AppStateStatus) => void) | null = null;
	jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler): NativeEventSubscription => {
		listener = handler;
		return { remove: jest.fn() };
	});
	memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
	const session = createSessionStore({ clearServerState: jest.fn() });
	session.dispatch(sessionActions.restored({ status: "signedIn", session: { scope: "full" } }));
	const preferences = createPreferencesStore({ applyTheme: jest.fn(), save: (): Promise<void> => Promise.resolve(), onSaveFailed: jest.fn() });
	preferences.dispatch(preferencesActions.restored({ ...DEFAULT_PREFERENCES, appLock: { enabled: lockEnabled, timeoutMs } }));
	const resetAppLock = jest.fn((): Promise<void> => Promise.resolve());
	const clock = { now: 1_000_000 };
	function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<SessionStoreProvider store={session}>
				<PreferencesStoreProvider store={preferences}>{children}</PreferencesStoreProvider>
			</SessionStoreProvider>
		);
	}
	const now = (): number => clock.now;
	const { result } = await renderHook(() => useAppLockLifecycle({ resetAppLock, now }), { wrapper: Wrapper });
	const emit = (state: AppStateStatus): void => {
		listener?.(state);
	};
	return { session, preferences, emit, result, resetAppLock, clock };
}

describe("useAppLockLifecycle (§11.2, §11.5)", () => {
	it("locks on return after the timeout", async () => {
		const harness = await setup(true);
		await act((): void => {
			harness.emit("background");
		});
		harness.clock.now += 60_000;
		await act((): void => {
			harness.emit("active");
		});

		await waitFor(() => {
			expect(harness.session.getState()).toEqual({ status: "locked" });
		});
	});

	it("does not lock on a quick return", async () => {
		const harness = await setup(true);
		await act((): void => {
			harness.emit("background");
		});
		harness.clock.now += 10_000;
		await act((): void => {
			harness.emit("active");
		});

		expect(harness.session.getState().status).toBe("signedIn");
	});

	it("Immediately locks on every return", async () => {
		const harness = await setup(true, 0);
		await act((): void => {
			harness.emit("background");
			harness.emit("active");
		});

		await waitFor(() => {
			expect(harness.session.getState()).toEqual({ status: "locked" });
		});
	});

	it("never locks with the lock off", async () => {
		const harness = await setup(false, 0);
		await act((): void => {
			harness.emit("background");
			harness.emit("active");
		});

		expect(harness.session.getState().status).toBe("signedIn");
	});

	it("resets the lock and signs out when the biometrics changed while away", async () => {
		const harness = await setup(true, 0);
		jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValueOnce(LocalAuthentication.SecurityLevel.SECRET);
		await act((): void => {
			harness.emit("background");
			harness.emit("active");
		});

		await waitFor(() => {
			expect(harness.session.getState()).toEqual({ status: "signedOut", reason: "appLockReset" });
		});
		expect(harness.resetAppLock).toHaveBeenCalledTimes(1);
	});

	it("covers the app while it is not active and the lock is on", async () => {
		const harness = await setup(true);
		expect(harness.result.current.isCoverVisible).toBe(false);
		await act((): void => {
			harness.emit("inactive");
		});
		expect(harness.result.current.isCoverVisible).toBe(true);
		await act((): void => {
			harness.emit("active");
		});
		expect(harness.result.current.isCoverVisible).toBe(false);
	});

	it("shows no cover with the lock off", async () => {
		const harness = await setup(false);
		await act((): void => {
			harness.emit("background");
		});
		expect(harness.result.current.isCoverVisible).toBe(false);
	});
});
