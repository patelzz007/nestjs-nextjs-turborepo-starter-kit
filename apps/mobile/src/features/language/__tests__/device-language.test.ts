import { deviceLanguageOf, type DeviceLocale } from "../device-language";

function locale(languageCode: string | null, regionCode: string | null = null, languageScriptCode: string | null = null): DeviceLocale {
	return { languageCode, regionCode, languageScriptCode };
}

describe("deviceLanguageOf (ADR 076 §3)", () => {
	it("takes the first of the phone's languages the app ships", () => {
		expect(deviceLanguageOf([locale("fr", "FR"), locale("ms", "MY"), locale("en", "GB")])).toBe("ms");
		expect(deviceLanguageOf([locale("ta", "IN")])).toBe("ta");
		expect(deviceLanguageOf([locale("en", "US")])).toBe("en");
	});

	it("reads Chinese as Simplified unless it is written in Traditional characters", () => {
		expect(deviceLanguageOf([locale("zh", "MY")])).toBe("zh-Hans");
		expect(deviceLanguageOf([locale("zh", "SG", "Hans")])).toBe("zh-Hans");
		expect(deviceLanguageOf([locale("zh", "TW"), locale("ms", "MY")])).toBe("ms");
		expect(deviceLanguageOf([locale("zh", "HK", "Hant")])).toBe("en");
		expect(deviceLanguageOf([locale("zh", "TW", "Hans")])).toBe("zh-Hans");
	});

	it("falls back to English when nothing matches, or the phone names no language", () => {
		expect(deviceLanguageOf([locale("fr", "FR"), locale(null)])).toBe("en");
		expect(deviceLanguageOf([])).toBe("en");
	});
});
