import { APP_LOCK_TIMEOUT_ONE_MINUTE_MS, type AppLockTimeoutMs, type ThemePreference } from "../../lib/secure-store";

/**
 * The device-only preferences (§9.7, §11): the appearance, the app lock
 * settings, and whether this device has been through onboarding (ADR 041). Owner: this Zustand feature store; persisted in Secure Store (never
 * AsyncStorage) and restored before the first frame.
 */
export interface PreferencesState {
	readonly theme: ThemePreference;
	readonly appLock: {
		readonly enabled: boolean;
		readonly timeoutMs: AppLockTimeoutMs;
	};
	/** The first-launch walkthrough was finished or skipped; it never shows again on this device. */
	readonly onboardingCompleted: boolean;
}

/** Defaults (§9.7, §11.2): follow the OS; app lock off; 60 s timeout; onboarding not seen yet. */
export const DEFAULT_PREFERENCES: PreferencesState = {
	theme: "system",
	appLock: { enabled: false, timeoutMs: APP_LOCK_TIMEOUT_ONE_MINUTE_MS },
	onboardingCompleted: false,
};
