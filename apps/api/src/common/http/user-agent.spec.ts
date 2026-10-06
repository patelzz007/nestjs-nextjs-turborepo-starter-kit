import { describe, expect, it } from "vitest";

import { parseUserAgent, type ParsedUserAgent } from "./user-agent";

/** Real User-Agent strings, as the clients send them. */
const UA = {
	chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
	chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
	edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.65",
	operaWindows: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
	firefoxLinux: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
	firefoxFedora: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
	safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1",
	safariIpad: "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
	chromePixel: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36",
	chromeAndroidReduced: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
	samsungGalaxy: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
	androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
	chromeOs: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
	ie11: "Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko",
	instagramIphone:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.34.89 (iPhone15,2; iOS 17_5; en_GB)",
	expoIos: "RewardHub/42 CFNetwork/1568.100.1 Darwin/24.0.0",
	expoAndroid: "okhttp/4.12.0",
	googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	googlebotSmartphone:
		"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
	slack: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
	headless: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
	curl: "curl/8.7.1",
	postman: "PostmanRuntime/7.42.0",
	pythonRequests: "python-requests/2.32.3",
	axios: "axios/1.7.7",
	goClient: "Go-http-client/2.0",
} satisfies Record<string, string>;

function expectParsed(userAgent: string, expected: Partial<ParsedUserAgent>): void {
	expect(parseUserAgent(userAgent)).toMatchObject(expected);
}

describe("parseUserAgent — desktop browsers", () => {
	it("Chrome on macOS", () => {
		expectParsed(UA.chromeMac, { browserName: "Chrome", browserVersion: "129.0.0.0", osName: "macOS", osVersion: "10.15.7", deviceType: "DESKTOP", deviceModel: null });
	});

	it("Chrome on Windows 10/11 (both report NT 10.0)", () => {
		expectParsed(UA.chromeWindows, { browserName: "Chrome", osName: "Windows", osVersion: "10/11", deviceType: "DESKTOP" });
	});

	it("Edge before Chrome, though it also says Chrome", () => {
		expectParsed(UA.edgeWindows, { browserName: "Edge", browserVersion: "129.0.2792.65" });
	});

	it("Opera before Chrome; Windows NT 6.1 is Windows 7", () => {
		expectParsed(UA.operaWindows, { browserName: "Opera", browserVersion: "114.0.0.0", osName: "Windows", osVersion: "7" });
	});

	it("Firefox on Ubuntu and on another Linux", () => {
		expectParsed(UA.firefoxLinux, { browserName: "Firefox", browserVersion: "131.0", osName: "Ubuntu", deviceType: "DESKTOP" });
		expectParsed(UA.firefoxFedora, { browserName: "Firefox", osName: "Linux", deviceType: "DESKTOP" });
	});

	it("Safari on macOS (Version/ carries the Safari version)", () => {
		expectParsed(UA.safariMac, { browserName: "Safari", browserVersion: "18.0", osName: "macOS", osVersion: "14.6.1" });
	});

	it("Chrome on ChromeOS", () => {
		expectParsed(UA.chromeOs, { browserName: "Chrome", osName: "ChromeOS", osVersion: "14541.0.0", deviceType: "DESKTOP" });
	});

	it("Internet Explorer 11 (Trident) on Windows 8.1", () => {
		expectParsed(UA.ie11, { browserName: "Internet Explorer", browserVersion: "11.0", osName: "Windows", osVersion: "8.1" });
	});
});

describe("parseUserAgent — phones and tablets", () => {
	it("Safari on iPhone", () => {
		expectParsed(UA.safariIphone, { browserName: "Safari", browserVersion: "18.0", osName: "iOS", osVersion: "18.0", deviceType: "MOBILE", deviceModel: "iPhone" });
	});

	it("Chrome on iPhone (CriOS)", () => {
		expectParsed(UA.chromeIphone, { browserName: "Chrome", browserVersion: "129.0.6668.69", osName: "iOS", osVersion: "17.6.1", deviceType: "MOBILE" });
	});

	it("an iPad is a tablet running iPadOS", () => {
		expectParsed(UA.safariIpad, { browserName: "Safari", osName: "iPadOS", osVersion: "17.6", deviceType: "TABLET", deviceModel: "iPad" });
	});

	it("Chrome on a Pixel names the model", () => {
		expectParsed(UA.chromePixel, { browserName: "Chrome", osName: "Android", osVersion: "14", deviceType: "MOBILE", deviceModel: "Pixel 8" });
	});

	it("drops the placeholder model of Chrome's reduced User-Agent", () => {
		expectParsed(UA.chromeAndroidReduced, { osName: "Android", osVersion: "10", deviceType: "MOBILE", deviceModel: null });
	});

	it("Samsung Internet before Chrome, with the Galaxy model code", () => {
		expectParsed(UA.samsungGalaxy, { browserName: "Samsung Internet", browserVersion: "26.0", deviceType: "MOBILE", deviceModel: "SM-S918B" });
	});

	it("an Android device without `Mobile` is a tablet", () => {
		expectParsed(UA.androidTablet, { osName: "Android", deviceType: "TABLET", deviceModel: "SM-X710" });
	});

	it("an in-app browser is named after its app", () => {
		expectParsed(UA.instagramIphone, { browserName: "Instagram", osName: "iOS", deviceType: "MOBILE" });
	});
});

describe("parseUserAgent — native apps", () => {
	it("the iOS app (CFNetwork) is an iOS phone", () => {
		expectParsed(UA.expoIos, { browserName: "CFNetwork", osName: "iOS", deviceType: "MOBILE" });
	});

	it("the Android app (okhttp) is an Android phone", () => {
		expectParsed(UA.expoAndroid, { browserName: "okhttp", osName: "Android", deviceType: "MOBILE" });
	});
});

describe("parseUserAgent — bots", () => {
	it("crawlers are bots, named and versioned", () => {
		expectParsed(UA.googlebot, { browserName: "Googlebot", browserVersion: "2.1", deviceType: "BOT" });
		expectParsed(UA.bingbot, { browserName: "bingbot", browserVersion: "2.0", deviceType: "BOT" });
	});

	it("a crawler disguised as a phone is still a bot (its OS is kept)", () => {
		expectParsed(UA.googlebotSmartphone, { browserName: "Googlebot", deviceType: "BOT", osName: "Android" });
	});

	it("link unfurlers and headless browsers are bots", () => {
		expectParsed(UA.slack, { browserName: "Slackbot-LinkExpanding", deviceType: "BOT" });
		expectParsed(UA.headless, { browserName: "HeadlessChrome", deviceType: "BOT" });
	});
});

describe("parseUserAgent — scripts and API tools", () => {
	it.each([
		[UA.curl, "curl", "8.7.1"],
		[UA.postman, "Postman", "7.42.0"],
		[UA.pythonRequests, "Python Requests", "2.32.3"],
		[UA.axios, "axios", "1.7.7"],
		[UA.goClient, "Go HTTP client", "2.0"],
	])("%s is the tool, on an unknown device", (userAgent, browserName, browserVersion) => {
		expectParsed(userAgent, { browserName, browserVersion, osName: null, deviceType: "UNKNOWN" });
	});
});

describe("parseUserAgent — nothing to go on", () => {
	it("an empty or missing User-Agent is an unknown client", () => {
		const unknown: ParsedUserAgent = { browserName: null, browserVersion: null, osName: null, osVersion: null, deviceType: "UNKNOWN", deviceModel: null };
		expect(parseUserAgent(undefined)).toEqual(unknown);
		expect(parseUserAgent(null)).toEqual(unknown);
		expect(parseUserAgent("   ")).toEqual(unknown);
	});

	it("free text that names nothing is unknown", () => {
		expect(parseUserAgent("my-integration-script")).toMatchObject({ browserName: null, osName: null, deviceType: "UNKNOWN" });
	});

	it("bounds every value to its column", () => {
		const parsed = parseUserAgent(`Mozilla/5.0 (Linux; Android 14; ${"X".repeat(200)}) AppleWebKit/537.36 Chrome/${"9".repeat(100)} Mobile Safari/537.36`);
		expect(parsed.deviceModel?.length).toBeLessThanOrEqual(64);
		expect(parsed.browserVersion?.length).toBeLessThanOrEqual(32);
	});
});
