// ============================================
// use-app-lock-lifecycle.ts - the lock's foreground/background behaviour (§11.2, §11.5)
// ============================================
// Records when the app goes to the background; on return, locks it when the
// lock is on and the timeout passed (or resets the lock when the enrolled
// biometrics changed). While the app is not active and the lock is on, a
// privacy cover hides the last screen from the app switcher snapshot.

import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAppLockEnabled, usePreferencesSnapshot } from "../preferences/facade";
import { useSessionCommands, useSessionSnapshot } from "../session/facade";
import { isEnrollmentUnchanged } from "./app-lock-enrollment";
import { shouldLockOnResume } from "./policy";

export interface AppLockLifecycleOptions {
	/** Turns the lock off and drops the session (src/runtime/app-runtime.ts). */
	readonly resetAppLock: () => Promise<void>;
	/** The clock, injectable for tests. */
	readonly now?: () => number;
}

export interface AppLockLifecycle {
	/** Show the privacy cover over the app. */
	readonly isCoverVisible: boolean;
}

export function useAppLockLifecycle({ resetAppLock, now = Date.now }: AppLockLifecycleOptions): AppLockLifecycle {
	const lockEnabled = useAppLockEnabled();
	const getPreferences = usePreferencesSnapshot();
	const getSession = useSessionSnapshot();
	const session = useSessionCommands();
	const backgroundedAt = React.useRef<number | null>(null);
	const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);

	React.useEffect((): (() => void) => {
		const lockIfDue = async (): Promise<void> => {
			const preferences = getPreferences();
			const due = shouldLockOnResume({
				lockEnabled: preferences.appLock.enabled,
				backgroundedAt: backgroundedAt.current,
				now: now(),
				timeoutMs: preferences.appLock.timeoutMs,
			});
			backgroundedAt.current = null;
			if (!due || getSession().status !== "signedIn") {
				return;
			}
			if (await isEnrollmentUnchanged()) {
				session.locked();
				return;
			}
			await resetAppLock();
			session.signedOut("appLockReset");
		};

		const subscription = AppState.addEventListener("change", (next: AppStateStatus): void => {
			setAppState(next);
			if (next === "background") {
				backgroundedAt.current = now();
			} else if (next === "active") {
				lockIfDue().catch((): void => {
					// The check itself failed: fail closed — lock rather than let the session through.
					session.locked();
				});
			}
		});
		return (): void => {
			subscription.remove();
		};
	}, [getPreferences, getSession, now, resetAppLock, session]);

	return { isCoverVisible: lockEnabled && (appState === "inactive" || appState === "background") };
}
