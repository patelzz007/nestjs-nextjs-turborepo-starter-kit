// Reading and writing the preferences in Secure Store. Every read is
// zod-validated with a default (a corrupt value is overwritten with it).

import { readSecureValueOrDefault, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";
import { DEFAULT_PREFERENCES, type PreferencesState } from "./state";

/** The stored preferences, each field falling back to its default. */
export async function loadPreferences(): Promise<PreferencesState> {
	const [theme, enabled, timeoutMs] = await Promise.all([
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.theme, DEFAULT_PREFERENCES.theme),
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockEnabled, DEFAULT_PREFERENCES.appLock.enabled),
		readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockTimeoutMs, DEFAULT_PREFERENCES.appLock.timeoutMs),
	]);
	return { theme, appLock: { enabled, timeoutMs } };
}

/** Writes every preference (each write is validated against its registry schema). */
export async function savePreferences(preferences: PreferencesState): Promise<void> {
	await writeSecureValue(SECURE_STORE_ENTRIES.theme, preferences.theme);
	await writeSecureValue(SECURE_STORE_ENTRIES.appLockEnabled, preferences.appLock.enabled);
	await writeSecureValue(SECURE_STORE_ENTRIES.appLockTimeoutMs, preferences.appLock.timeoutMs);
}
