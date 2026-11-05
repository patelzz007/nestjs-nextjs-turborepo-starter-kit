// ============================================
// Firebase Crashlytics as the crash reporter (enhancement 6.2, Q16)
// ============================================
// Firebase for now (your decision, 2026-11-03); ADR 069's in-house observability can replace
// it later behind the same `CrashReporter`. The SDK is loaded only where its native module
// exists: Expo Go has none, and importing it there would fail. A build has it once the
// Firebase config file is given (app.config.ts → GOOGLE_SERVICES_JSON).
//
// No personal data: the app never sets a user id, email or name on the reports.

import { TurboModuleRegistry, type TurboModule } from "react-native";

import type { CrashReporter } from "./crash-reporter";

/** Crashlytics' native module, registered by a build that includes it. */
export const CRASHLYTICS_NATIVE_MODULE = "NativeRNFBTurboCrashlytics";

/** The Crashlytics calls the reporter uses. */
export interface CrashlyticsSdk {
	/** Turns collection on (release builds) or off (development builds). */
	setCollectionEnabled(enabled: boolean): Promise<void>;
	recordError(error: Error, where: string): void;
}

/** How the reporter finds and loads the SDK (the real device, or a test's stand-ins). */
export interface CrashlyticsLoader {
	hasNativeModule(): boolean;
	load(): Promise<CrashlyticsSdk>;
}

async function loadCrashlyticsSdk(): Promise<CrashlyticsSdk> {
	const { getCrashlytics, recordError, setCrashlyticsCollectionEnabled } = await import("@react-native-firebase/crashlytics");
	const crashlytics = getCrashlytics();
	return {
		setCollectionEnabled: async (enabled: boolean): Promise<void> => {
			await setCrashlyticsCollectionEnabled(crashlytics, enabled);
		},
		recordError: (error: Error, where: string): void => {
			recordError(crashlytics, error, where);
		},
	};
}

export const DEVICE_CRASHLYTICS_LOADER: CrashlyticsLoader = {
	hasNativeModule: (): boolean => TurboModuleRegistry.get<TurboModule>(CRASHLYTICS_NATIVE_MODULE) !== null,
	load: loadCrashlyticsSdk,
};

/**
 * The Crashlytics reporter, or `null` where the build has no Crashlytics. `collect` is off in development
 * builds, so a developer's crashes never mix into the release reports.
 */
export async function loadFirebaseCrashReporter(collect: boolean, loader: CrashlyticsLoader = DEVICE_CRASHLYTICS_LOADER): Promise<CrashReporter | null> {
	if (!loader.hasNativeModule()) {
		return null;
	}
	const sdk = await loader.load();
	await sdk.setCollectionEnabled(collect);
	return {
		recordError: (error: Error, where: string): void => {
			sdk.recordError(error, where);
		},
	};
}
