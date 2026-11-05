// Reading and writing the preferences in Secure Store. Every read is
// zod-validated with a default (a corrupt value is overwritten with it).

import { deleteSecureValue, readSecureValue, readSecureValueOrDefault, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";
import { DEFAULT_PREFERENCES, type PreferencesState } from "./state";

/** The stored preferences, each field falling back to its default. */
export async function loadPreferences(): Promise<PreferencesState> {
	const [theme, enabled, timeoutMs, language, onboardingCompleted] = await Promise.all([
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.theme, DEFAULT_PREFERENCES.theme),
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockEnabled, DEFAULT_PREFERENCES.appLock.enabled),
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockTimeoutMs, DEFAULT_PREFERENCES.appLock.timeoutMs),
		// No choice stored, or the store unreadable right now: the phone's language applies, as before a choice.
		readSecureValue(SECURE_STORE_ENTRIES.language).catch((): null => null),
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.onboardingCompleted, DEFAULT_PREFERENCES.onboardingCompleted),
	]);
	return { theme, appLock: { enabled, timeoutMs }, language, onboardingCompleted };
}

/** Writes every preference (each write is validated against its registry schema). */
export async function savePreferences(preferences: PreferencesState): Promise<void> {
	await writeSecureValue(SECURE_STORE_ENTRIES.theme, preferences.theme);
	await writeSecureValue(SECURE_STORE_ENTRIES.appLockEnabled, preferences.appLock.enabled);
	await writeSecureValue(SECURE_STORE_ENTRIES.appLockTimeoutMs, preferences.appLock.timeoutMs);
	await (preferences.language === null ? deleteSecureValue(SECURE_STORE_ENTRIES.language) : writeSecureValue(SECURE_STORE_ENTRIES.language, preferences.language));
	await writeSecureValue(SECURE_STORE_ENTRIES.onboardingCompleted, preferences.onboardingCompleted);
}
