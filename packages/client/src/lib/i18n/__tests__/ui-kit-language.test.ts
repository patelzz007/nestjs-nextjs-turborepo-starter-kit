import { AppLanguageSchema } from "@workspace/shared";
import { UI_KIT_LANGUAGES } from "@workspace/ui/lib/labels/language-packs";
import { describe, expect, it } from "vitest";

import { PICKABLE_UI_KIT_LANGUAGES, resolveUiKitLanguage, uiKitLanguageOfAcceptLanguage, uiKitLanguageOfTag } from "../ui-kit-language";

describe("uiKitLanguageOfTag", () => {
	it("maps regional tags onto the shipped packs", () => {
		expect(["en-MY", "ms-MY", "ms", "zsm", "ta-IN", "ta-MY"].map(uiKitLanguageOfTag)).toStrictEqual(["en", "ms", "ms", "ms", "ta", "ta"]);
	});

	it("reads Simplified Chinese from its script or its region, and refuses Traditional", () => {
		expect(["zh", "zh-Hans", "zh-Hans-MY", "zh-MY", "zh-SG", "zh-CN"].map(uiKitLanguageOfTag)).toStrictEqual([
			"zh-Hans",
			"zh-Hans",
			"zh-Hans",
			"zh-Hans",
			"zh-Hans",
			"zh-Hans",
		]);
		expect(["zh-Hant", "zh-TW", "zh-HK"].map(uiKitLanguageOfTag)).toStrictEqual([null, null, null]);
	});

	it("knows nothing of other languages", () => {
		expect(["fr", "hi-IN", ""].map(uiKitLanguageOfTag)).toStrictEqual([null, null, null]);
	});
});

describe("uiKitLanguageOfAcceptLanguage", () => {
	it("takes the highest-weighted shipped language, in order on ties", () => {
		expect(uiKitLanguageOfAcceptLanguage("fr-FR,fr;q=0.9,ms;q=0.8,en;q=0.7")).toBe("ms");
		expect(uiKitLanguageOfAcceptLanguage("ta;q=0.5, zh-Hans-MY;q=0.9")).toBe("zh-Hans");
		expect(uiKitLanguageOfAcceptLanguage("ms, ta")).toBe("ms");
	});

	it("ignores q=0, wildcards and malformed entries; null when nothing matches", () => {
		expect(uiKitLanguageOfAcceptLanguage("ms;q=0, ta")).toBe("ta");
		expect(uiKitLanguageOfAcceptLanguage("*, fr")).toBeNull();
		expect(uiKitLanguageOfAcceptLanguage(";;;, en-GB")).toBe("en");
		expect(uiKitLanguageOfAcceptLanguage(null)).toBeNull();
	});
});

describe("resolveUiKitLanguage", () => {
	it("prefers the cookie, then the browser, then English", () => {
		expect(resolveUiKitLanguage({ cookie: "ta", acceptLanguage: "ms" })).toBe("ta");
		expect(resolveUiKitLanguage({ cookie: "klingon", acceptLanguage: "ms-MY" })).toBe("ms");
		expect(resolveUiKitLanguage({ cookie: undefined, acceptLanguage: "fr" })).toBe("en");
		expect(PICKABLE_UI_KIT_LANGUAGES).toStrictEqual(["en", "ms", "zh-Hans", "ta"]);
	});
});

describe("the shipped languages (enhancement 5.2)", () => {
	it("are the same for the UI kit and the profile the API saves", () => {
		expect([...UI_KIT_LANGUAGES]).toStrictEqual([...AppLanguageSchema.options]);
	});
});
