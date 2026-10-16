// ============================================
// google-code-scanner-module.ts - an Expo config plugin for release builds
// ============================================
// A real Android build (APK / AAB, `Constants.executionEnvironment` is not
// `StoreClient`) scans QR codes with Google's code scanner (ui-native
// `QrScanner`, lib/qr-scanner-engine.ts). That scanner is a Google Play
// services module that Play otherwise downloads the first time it is opened,
// so a till's first scan on a fresh install would wait for a download. This
// plugin adds the manifest entry that asks Play to download it when the app is
// INSTALLED (`com.google.mlkit.vision.DEPENDENCIES` = `barcode_ui`, Google's
// documented setting for the code scanner).
//
// Registered in app.config.ts by its path (`plugins`), so Expo's own plugin
// loader transpiles it on every supported Node version. It runs only when the
// native project is generated (`expo prebuild`,
// `expo run:android`, EAS Build); Expo Go never reads it, and Expo Go uses the
// in-app camera scanner anyway.

import { AndroidConfig, withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

/** The manifest meta-data naming the ML Kit modules Play installs with the app. */
export const MLKIT_DEPENDENCIES_META_DATA = "com.google.mlkit.vision.DEPENDENCIES";

/** Google's code scanner module (the full-screen scanner `launchScanner` opens). */
export const GOOGLE_CODE_SCANNER_MODULE = "barcode_ui";

/** The value lists several modules separated by commas ("barcode_ui,ocr"). */
const MODULE_SEPARATOR = ",";

/** The modules already requested, plus the code scanner, each once. */
export function mlKitModulesWithCodeScanner(current: string | null): string {
	const modules = (current ?? "")
		.split(MODULE_SEPARATOR)
		.map((module: string): string => module.trim())
		.filter((module: string): boolean => module.length > 0);
	return [...new Set([...modules, GOOGLE_CODE_SCANNER_MODULE])].join(MODULE_SEPARATOR);
}

/**
 * Requests the code scanner module in the manifest's `<application>`, keeping
 * any module another plugin already requested. Expo's mod API hands the
 * manifest to be changed in place; it is returned for the mod chain.
 */
export function withCodeScannerModuleRequested(manifest: AndroidConfig.Manifest.AndroidManifest): AndroidConfig.Manifest.AndroidManifest {
	const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
	const current = AndroidConfig.Manifest.getMainApplicationMetaDataValue(manifest, MLKIT_DEPENDENCIES_META_DATA);
	AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, MLKIT_DEPENDENCIES_META_DATA, mlKitModulesWithCodeScanner(current));
	return manifest;
}

export const withGoogleCodeScannerModule: ConfigPlugin = (config) =>
	withAndroidManifest(config, (modConfig) => {
		withCodeScannerModuleRequested(modConfig.modResults);
		return modConfig;
	});

export default withGoogleCodeScannerModule;
