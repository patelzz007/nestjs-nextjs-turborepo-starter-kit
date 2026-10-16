import { AndroidConfig } from "expo/config-plugins";
import { z } from "zod";

import withGoogleCodeScannerModuleDefault, {
	GOOGLE_CODE_SCANNER_MODULE,
	MLKIT_DEPENDENCIES_META_DATA,
	mlKitModulesWithCodeScanner,
	withCodeScannerModuleRequested,
	withGoogleCodeScannerModule,
} from "../google-code-scanner-module";

/** A generated AndroidManifest.xml as Expo parses it: one `<application>`. */
function manifestWith(metaData: readonly { readonly name: string; readonly value: string }[]): AndroidConfig.Manifest.AndroidManifest {
	return {
		manifest: {
			$: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
			queries: [],
			application: [
				{
					$: { "android:name": ".MainApplication" },
					"meta-data": metaData.map((item) => ({ $: { "android:name": item.name, "android:value": item.value } })),
				},
			],
		},
	};
}

describe("mlKitModulesWithCodeScanner", () => {
	it("requests the code scanner when nothing is requested yet", () => {
		expect(mlKitModulesWithCodeScanner(null)).toBe(GOOGLE_CODE_SCANNER_MODULE);
		expect(mlKitModulesWithCodeScanner("")).toBe(GOOGLE_CODE_SCANNER_MODULE);
	});

	it("keeps the modules already requested, and never lists one twice", () => {
		expect(mlKitModulesWithCodeScanner("ocr, face")).toBe("ocr,face,barcode_ui");
		expect(mlKitModulesWithCodeScanner("barcode_ui,ocr")).toBe("barcode_ui,ocr");
	});
});

describe("withCodeScannerModuleRequested", () => {
	it("adds the install-time request to the application", () => {
		const manifest = withCodeScannerModuleRequested(manifestWith([]));

		expect(AndroidConfig.Manifest.getMainApplicationMetaDataValue(manifest, MLKIT_DEPENDENCIES_META_DATA)).toBe(GOOGLE_CODE_SCANNER_MODULE);
	});

	it("merges into a request another plugin made", () => {
		const manifest = withCodeScannerModuleRequested(manifestWith([{ name: MLKIT_DEPENDENCIES_META_DATA, value: "ocr" }]));

		expect(AndroidConfig.Manifest.getMainApplicationMetaDataValue(manifest, MLKIT_DEPENDENCIES_META_DATA)).toBe("ocr,barcode_ui");
	});

	it("is idempotent across repeated prebuilds", () => {
		const manifest = withCodeScannerModuleRequested(withCodeScannerModuleRequested(manifestWith([])));

		expect(AndroidConfig.Manifest.getMainApplicationMetaDataValue(manifest, MLKIT_DEPENDENCIES_META_DATA)).toBe(GOOGLE_CODE_SCANNER_MODULE);
		expect(manifest.manifest.application?.at(0)?.["meta-data"]).toHaveLength(1);
	});
});

/** A config carrying an Android manifest mod (`ExpoConfig`'s type does not declare `mods`). */
const AndroidManifestModSchema = z.object({ mods: z.object({ android: z.object({ manifest: z.instanceof(Function) }) }) });

describe("withGoogleCodeScannerModule", () => {
	it("registers an Android manifest change, and is the file's default export (app.config.ts loads it by path)", () => {
		const config = withGoogleCodeScannerModule({ name: "Starter", slug: "starter" });

		expect(AndroidManifestModSchema.safeParse(config).success).toBe(true);
		expect(withGoogleCodeScannerModuleDefault).toBe(withGoogleCodeScannerModule);
	});
});
