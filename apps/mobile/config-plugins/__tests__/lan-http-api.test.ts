import { AndroidConfig } from "expo/config-plugins";
import { z } from "zod";

import withLanHttpApiDefault, { withCleartextTraffic, withLanHttpApi } from "../lan-http-api";

/** A generated AndroidManifest.xml as Expo parses it: one `<application>`, with the given attributes. */
function manifestWith(attributes: Record<string, string>): AndroidConfig.Manifest.AndroidManifest {
	return {
		manifest: {
			$: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
			queries: [],
			application: [{ $: { "android:name": ".MainApplication", ...attributes } }],
		},
	};
}

function cleartextOf(manifest: AndroidConfig.Manifest.AndroidManifest): string | undefined {
	return AndroidConfig.Manifest.getMainApplicationOrThrow(manifest).$["android:usesCleartextTraffic"];
}

describe("withCleartextTraffic", () => {
	it("allows plain http in a LAN test build", () => {
		expect(cleartextOf(withCleartextTraffic(manifestWith({}), true))).toBe("true");
	});

	it("leaves Android's https-only default in any other build", () => {
		expect(cleartextOf(withCleartextTraffic(manifestWith({}), false))).toBeUndefined();
	});

	it("takes the permission away again when a later prebuild runs without the flag", () => {
		const testBuild = withCleartextTraffic(manifestWith({}), true);

		expect(cleartextOf(withCleartextTraffic(testBuild, false))).toBeUndefined();
	});

	it("is idempotent across repeated prebuilds, and keeps the application's other attributes", () => {
		const manifest = withCleartextTraffic(withCleartextTraffic(manifestWith({ "android:allowBackup": "false" }), true), true);

		expect(cleartextOf(manifest)).toBe("true");
		expect(AndroidConfig.Manifest.getMainApplicationOrThrow(manifest).$["android:allowBackup"]).toBe("false");
	});
});

/** A config carrying an Android manifest mod (`ExpoConfig`'s type does not declare `mods`). */
const AndroidManifestModSchema = z.object({ mods: z.object({ android: z.object({ manifest: z.instanceof(Function) }) }) });

describe("withLanHttpApi", () => {
	it("registers an Android manifest change, and is the file's default export (app.config.ts loads it by path)", () => {
		const config = withLanHttpApi({ name: "Starter", slug: "starter" }, { enabled: true });

		expect(AndroidManifestModSchema.safeParse(config).success).toBe(true);
		expect(withLanHttpApiDefault).toBe(withLanHttpApi);
	});
});
