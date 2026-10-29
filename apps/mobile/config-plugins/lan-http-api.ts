// ============================================
// lan-http-api.ts - an Expo config plugin for a LAN test APK
// ============================================
// A test APK can talk to the API on the developer's machine over the office or
// home Wi-Fi, with no USB cable and no Metro: it is built with
// `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true` and `EXPO_PUBLIC_API_URL=http://<the
// machine's LAN address>:8080` (docs/technical/mobile/building-installable-apps.md).
// The app's own check (src/lib/env.ts) then accepts http, but only to a private
// LAN address. Android refuses plain http in a release build regardless, so
// this plugin turns on `android:usesCleartextTraffic` in the generated
// manifest — for that build only. Without the flag it removes the attribute
// again, so a store build made after a test build is https-only, as Android's
// default is.
//
// A debug build is not affected: its own manifest (src/debug) allows http for
// Metro already. Registered in app.config.ts with the flag as its option; it
// runs when the native project is generated (`expo prebuild`,
// `expo run:android`, EAS Build), so change the flag, then prebuild again.

import { AndroidConfig, withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

export interface LanHttpApiOptions {
	/** `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true` at prebuild: this build may use plain http (to a LAN address, src/lib/env.ts). */
	readonly enabled: boolean;
}

/**
 * The manifest with plain http allowed (`enabled`), or with the attribute removed so Android's
 * https-only default applies. Expo's mod API hands the manifest to be changed in place; it is
 * returned for the mod chain.
 */
export function withCleartextTraffic(manifest: AndroidConfig.Manifest.AndroidManifest, enabled: boolean): AndroidConfig.Manifest.AndroidManifest {
	const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
	if (enabled) {
		// `android:usesCleartextTraffic`: the app may open plain http connections.
		application.$["android:usesCleartextTraffic"] = "true";
	} else {
		delete application.$["android:usesCleartextTraffic"];
	}
	return manifest;
}

export const withLanHttpApi: ConfigPlugin<LanHttpApiOptions> = (config, options) =>
	withAndroidManifest(config, (modConfig) => {
		withCleartextTraffic(modConfig.modResults, options.enabled);
		return modConfig;
	});

export default withLanHttpApi;
