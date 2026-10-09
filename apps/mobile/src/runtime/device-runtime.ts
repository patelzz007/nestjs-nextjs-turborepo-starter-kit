// The app runtime wired to the real device: environment, version, device
// details, Uniwind and Secure Store.

import Constants from "expo-constants";

import { readAppVersion, readBuildNumber } from "../lib/app-version";
import { readDeviceDetails } from "../lib/device-headers";
import { readRawMobileEnv } from "../lib/env";
import { savePreferences } from "../features/preferences/persistence";
import { applyThemePreference } from "../features/preferences/theme";
import { createAppRuntime, type AppRuntime } from "./app-runtime";

/** Shown on the privacy cover when the manifest has no name (never in a real build). */
const FALLBACK_APP_NAME = "App";

export function createDeviceAppRuntime(): AppRuntime {
	return createAppRuntime({
		rawEnv: readRawMobileEnv(),
		appName: Constants.expoConfig?.name ?? FALLBACK_APP_NAME,
		readAppVersion,
		buildNumber: readBuildNumber(),
		deviceDetails: readDeviceDetails(),
		applyTheme: applyThemePreference,
		savePreferences,
		reportWarning: (message: string, error: Error): void => {
			console.warn(message, error);
		},
	});
}
