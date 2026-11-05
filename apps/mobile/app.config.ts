// ============================================
// app.config.ts - the mobile app's identity and native configuration
// ============================================
// Read by the Expo CLI on the developer's machine (and by a native build),
// never bundled into the app. Products built on the starter rename the app by
// setting the MOBILE_* variables, never by editing this file
// (docs/technical/mobile/mobile-app.md §9.3, docs/technical/configuration/frontend.md).
// Every variable it uses is read and validated once, by build-env/app-config-env.ts (the build's
// twin of src/lib/env.ts); a wrong one stops `expo start` / `expo export` with the variable's name.

import type { ConfigContext, ExpoConfig } from "expo/config";
import { z } from "zod";

import generatedLaunchColors from "./assets/launch-colors.json";
// With its extension: Expo's config loader (Node, not Metro) resolves only explicit `.ts` paths from here.
import { passkeyAssociatedDomains, readAppConfigEnv } from "./build-env/app-config-env.ts";

/**
 * The app's own semantic version, sent as `X-App-Version` on every request
 * (ADR 033). Raise it with every store release; the API's
 * `MOBILE_MIN_SUPPORTED_VERSION` is compared against it.
 */
const APP_VERSION = "1.0.1";

/** What iOS shows when the app lock first asks for Face ID (real builds only; Expo Go cannot use Face ID). */
const FACE_ID_PERMISSION = "Allow $(PRODUCT_NAME) to use Face ID to unlock the app.";
/** Photos are only picked to attach to a GitHub comment; the microphone is never used, so it is blocked. */
const PHOTOS_PERMISSION = "Allow $(PRODUCT_NAME) to attach your photos to the comments you write and to read QR codes from them.";
/**
 * The camera reads QR codes only — the till's scanner (features/till). It is
 * NOT blocked for expo-image-picker either: that plugin's `cameraPermission:
 * false` adds android.permission.CAMERA to the blocked permissions, which would
 * stop the scanner in a real build. Android's Google code scanner needs no
 * permission at all (Play services owns the camera); iOS and the in-app
 * scanner ask for it the moment the scanner opens.
 */
const CAMERA_PERMISSION = "Allow $(PRODUCT_NAME) to use the camera to scan QR codes.";

/**
 * The launch assets, generated from the brand mark and the `splash` colour
 * tokens by `pnpm tools tokens:generate` (packages/tokens, ADR 043) — never edited here.
 */
const APP_ICON = "./assets/app-icon.png";
const SPLASH_IMAGE = "./assets/splash-icon.png";
/** The mark's width on the native splash, in points — the in-app launch screen draws it at the same size (src/components/launch-screen.tsx `LAUNCH_MARK_SIZE`). */
const SPLASH_IMAGE_WIDTH = 96;

const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/u, "must be #rrggbb");
const LaunchColorsSchema = z.object({ backgroundColor: HexColorSchema, foregroundColor: HexColorSchema });

type LaunchColors = z.output<typeof LaunchColorsSchema>;

function readLaunchColors(): LaunchColors {
	const parsed = LaunchColorsSchema.safeParse(generatedLaunchColors);
	if (!parsed.success) {
		throw new Error(`Invalid assets/launch-colors.json — run \`pnpm tools tokens:generate\` (${parsed.error.issues.map((issue): string => issue.message).join("; ")})`);
	}
	return parsed.data;
}

/**
 * Crash reporting (enhancement 6.2): Firebase Crashlytics, in a build given Firebase's config. Without it the
 * build has no Crashlytics and the app reports nothing (exactly as before).
 */
const FIREBASE_CRASH_REPORTING_PLUGINS: readonly string[] = ["@react-native-firebase/app", "@react-native-firebase/crashlytics"];

export default function appConfig({ config }: ConfigContext): ExpoConfig {
	const identity = readAppConfigEnv();
	const launchColors = readLaunchColors();
	const lanHttpApi = identity.EXPO_PUBLIC_ALLOW_LAN_HTTP_API;
	// Firebase's Android (FCM push, ADR 070) and iOS (crash reporting, 6.2) config files, when the build has them.
	const firebaseConfig = identity.GOOGLE_SERVICES_JSON;
	const firebaseIosConfig = identity.GOOGLE_SERVICES_PLIST;
	// The iOS passkey entitlement (ADR 080): `webcredentials:<MOBILE_PASSKEY_DOMAIN>`, or none.
	const associatedDomains = passkeyAssociatedDomains(identity.MOBILE_PASSKEY_DOMAIN);
	// The same slate splash in light and dark: launching looks the same whatever the theme.
	const splash = { image: SPLASH_IMAGE, imageWidth: SPLASH_IMAGE_WIDTH, backgroundColor: launchColors.backgroundColor, resizeMode: "contain" };
	return {
		...config,
		name: identity.MOBILE_APP_NAME,
		slug: identity.MOBILE_APP_SLUG,
		scheme: identity.MOBILE_SCHEME,
		version: APP_VERSION,
		icon: APP_ICON,
		orientation: "portrait",
		// System / Light / Dark is chosen in the app (Settings → Appearance); "automatic" lets it follow the OS.
		userInterfaceStyle: "automatic",
		// The three Next.js apps cover the browser; the Expo web target is off (§2, decision 2).
		platforms: ["ios", "android"],
		// The React Compiler memoizes every component and hook of the app and the UI kit (not node_modules):
		// a parent's re-render no longer re-renders children whose props did not change. The code already
		// follows its rules (the `react-hooks-js` lint rules run in CI).
		experiments: { ...config.experiments, reactCompiler: true },
		ios: {
			bundleIdentifier: identity.MOBILE_BUNDLE_ID,
			supportsTablet: true,
			...(associatedDomains.length === 0 ? {} : { associatedDomains }),
			...(firebaseIosConfig === undefined ? {} : { googleServicesFile: firebaseIosConfig }),
		},
		android: {
			package: identity.MOBILE_BUNDLE_ID,
			adaptiveIcon: { foregroundImage: APP_ICON, backgroundColor: launchColors.backgroundColor },
			...(firebaseConfig === undefined ? {} : { googleServicesFile: firebaseConfig }),
		},
		plugins: [
			// Async routes in development only: each screen bundles on first visit, so the dev server starts
			// faster. Native production builds keep a single bundle (`production` is web-only in SDK 57).
			["expo-router", { asyncRoutes: "development" }],
			"expo-secure-store",
			["expo-local-authentication", { faceIDPermission: FACE_ID_PERMISSION }],
			["expo-image-picker", { photosPermission: PHOTOS_PERMISSION, cameraPermission: CAMERA_PERMISSION, microphonePermission: false }],
			// QR scanning only: no microphone, no audio recording.
			["expo-camera", { cameraPermission: CAMERA_PERMISSION, microphonePermission: false, recordAudioAndroid: false, barcodeScannerEnabled: true }],
			// Release builds scan with Google's code scanner: Play installs its module with the app.
			"./config-plugins/google-code-scanner-module.ts",
			// Release builds are shrunk by R8: keep what native code finds by name (error codes, ML Kit).
			"./config-plugins/release-keep-rules.ts",
			// No yellow autofill highlight over a filled-in field, in any theme (Android draws it, not the app).
			"./config-plugins/autofill-highlight.ts",
			// Over-the-air updates (6.3): EAS Update on a channel per build, once EAS_PROJECT_ID is set.
			["./config-plugins/over-the-air-updates.ts", { projectId: identity.EAS_PROJECT_ID }],
			// A LAN test APK only: plain http to the developer's machine (off, and https-only, in every other build).
			["./config-plugins/lan-http-api.ts", { enabled: lanHttpApi }],
			["expo-splash-screen", { ...splash, dark: splash }],
			"expo-font",
			"expo-image",
			"expo-sharing",
			// Push (ADR 070): FCM on Android, APNs on iOS; the app asks for permission after its own primer.
			["expo-notifications", { color: launchColors.backgroundColor }],
			...(firebaseConfig === undefined ? [] : FIREBASE_CRASH_REPORTING_PLUGINS),
		],
	};
}
