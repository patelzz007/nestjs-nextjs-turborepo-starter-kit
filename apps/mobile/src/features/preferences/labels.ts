// Display labels of the preference values (one place, so Settings and its sub-screens agree).

import {
	APP_LOCK_TIMEOUT_FIVE_MINUTES_MS,
	APP_LOCK_TIMEOUT_IMMEDIATELY_MS,
	APP_LOCK_TIMEOUT_ONE_MINUTE_MS,
	type AppLockTimeoutMs,
	type ThemePreference,
} from "../../lib/secure-store";
import type { RadioOption } from "../../components/radio-group";

export const THEME_OPTIONS: readonly RadioOption<ThemePreference>[] = [
	{ value: "system", label: "System", description: "Follow the device's light or dark setting" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = { system: "System", light: "Light", dark: "Dark" };

export const APP_LOCK_TIMEOUT_OPTIONS: readonly RadioOption<AppLockTimeoutMs>[] = [
	{ value: APP_LOCK_TIMEOUT_IMMEDIATELY_MS, label: "Immediately" },
	{ value: APP_LOCK_TIMEOUT_ONE_MINUTE_MS, label: "After 1 minute" },
	{ value: APP_LOCK_TIMEOUT_FIVE_MINUTES_MS, label: "After 5 minutes" },
];
