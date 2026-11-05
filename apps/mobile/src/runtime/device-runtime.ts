// The app runtime wired to the real device: environment, version, device
// details, Uniwind and Secure Store.

import Constants from "expo-constants";

import { readAppVersion, readBuildNumber } from "../lib/app-version";
import { readBuildIdentity } from "../lib/build-identity-device";
import { reportError } from "../lib/crash-reporting/crash-reporter";
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
		build: readBuildIdentity(),
		deviceDetails: readDeviceDetails(),
		applyTheme: applyThemePreference,
		savePreferences,
		reportWarning: (message: string, error: Error): void => {
			console.warn(message, error);
			// A warning is an error the app recovered from: worth seeing in the crash reports too (6.2).
			reportError(error, message);
		},
	});
}
