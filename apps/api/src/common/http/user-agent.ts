// ============================================
// common/http/user-agent.ts — browser / OS / device from a User-Agent string
// ============================================
// Pure and dependency-free: a small, ordered rule set covering the clients
// this platform actually sees — evergreen browsers (desktop, mobile, in-app),
// the Expo / React Native apps (CFNetwork on iOS, okhttp on Android), HTTP
// tools and scripts (curl, Postman, SDKs) and crawlers. It is a best-effort
// DESCRIPTION of what the client claimed: a User-Agent is free text and can be
// forged, which is why the raw string is always stored next to the result.
//
// Rule order matters (most specific first): Edge, Opera, Samsung Internet …
// all also contain "Chrome/"; Chrome contains "Safari/".

import type { DeviceType } from "@workspace/shared";

/** What a User-Agent says about the client. Every field is `null` when the string does not tell. */
export interface ParsedUserAgent {
	readonly browserName: string | null;
	readonly browserVersion: string | null;
	readonly osName: string | null;
	readonly osVersion: string | null;
	readonly deviceType: DeviceType;
	readonly deviceModel: string | null;
}

/** Column budgets (prisma/schema.prisma `AuditLog`). */
const NAME_MAX_LENGTH = 64;
const VERSION_MAX_LENGTH = 32;
const MODEL_MAX_LENGTH = 64;

interface NamedPattern {
	readonly name: string;
	/** The `version` named group, when present, is the version. */
	readonly pattern: RegExp;
}

/** Crawlers, link unfurlers and monitors: the device is a bot. Named groups: `name`, `version`. */
const BOT_PATTERN =
	/\b(?<name>(?:google|bing|yandex|duckduck|baidu|apple|petal|ahrefs|semrush|mj12|dot|gpt|claude|cc|amazon|facebook|twitter|linkedin|slack|discord|telegram|pinterest)?(?:bot|spider|crawler)[\w-]*|facebookexternalhit|Slurp|Bytespider|HeadlessChrome|Lighthouse|Pingdom\w*|UptimeRobot|StatusCake|WhatsApp)(?:\/(?<version>[\w.]+))?/i;

/** Non-browser HTTP clients (scripts, SDKs, API tools). Matched at the START of the string. */
const HTTP_CLIENTS: readonly NamedPattern[] = [
	{ name: "curl", pattern: /^curl\/(?<version>[\d.]+)/i },
	{ name: "Wget", pattern: /^Wget\/(?<version>[\d.]+)/i },
	{ name: "Postman", pattern: /^PostmanRuntime\/(?<version>[\d.]+)/ },
	{ name: "Insomnia", pattern: /^insomnia\/(?<version>[\d.]+)/i },
	{ name: "HTTPie", pattern: /^HTTPie\/(?<version>[\d.]+)/i },
	{ name: "Python Requests", pattern: /^python-requests\/(?<version>[\d.]+)/i },
	{ name: "Python HTTPX", pattern: /^python-httpx\/(?<version>[\d.]+)/i },
	{ name: "Python urllib", pattern: /^Python-urllib\/(?<version>[\d.]+)/i },
	{ name: "axios", pattern: /^axios\/(?<version>[\d.]+)/i },
	{ name: "node-fetch", pattern: /^node-fetch(?:\/(?<version>[\d.]+))?/i },
	{ name: "undici", pattern: /^undici(?:\/(?<version>[\d.]+))?/i },
	{ name: "Node.js", pattern: /^node(?:\/v?(?<version>[\d.]+))?$/i },
	{ name: "Go HTTP client", pattern: /^Go-http-client\/(?<version>[\d.]+)/ },
	{ name: "Java HTTP client", pattern: /^Java(?:-http-client)?\/(?<version>[\d.]+)/ },
	{ name: "Apache HttpClient", pattern: /^Apache-HttpClient\/(?<version>[\d.]+)/ },
	{ name: "Dart", pattern: /^Dart\/(?<version>[\d.]+)/ },
];

/** Browsers, most specific first. */
const BROWSERS: readonly NamedPattern[] = [
	{ name: "Edge", pattern: /\bEdg(?:e|A|iOS)?\/(?<version>[\d.]+)/ },
	{ name: "Opera", pattern: /\b(?:OPR|OPT|Opera)\/(?<version>[\d.]+)/ },
	{ name: "Samsung Internet", pattern: /\bSamsungBrowser\/(?<version>[\d.]+)/ },
	{ name: "Vivaldi", pattern: /\bVivaldi\/(?<version>[\d.]+)/ },
	{ name: "Yandex Browser", pattern: /\bYaBrowser\/(?<version>[\d.]+)/ },
	{ name: "UC Browser", pattern: /\bUCBrowser\/(?<version>[\d.]+)/ },
	{ name: "Instagram", pattern: /\bInstagram (?<version>[\d.]+)/ },
	{ name: "Facebook", pattern: /\bFB(?:AV|_IAB)\/(?<version>[\d.]+)/ },
	{ name: "Firefox", pattern: /\b(?:Firefox|FxiOS)\/(?<version>[\d.]+)/ },
	{ name: "Chrome", pattern: /\b(?:Chrome|CriOS|Chromium)\/(?<version>[\d.]+)/ },
	{ name: "Internet Explorer", pattern: /\b(?:MSIE |Trident\/.*rv:)(?<version>[\d.]+)/ },
	{ name: "Safari", pattern: /\bVersion\/(?<version>[\d.]+)(?: Mobile\/\w+)? Safari\// },
];

/** `Windows NT x.y` → the marketing version (Windows 11 still reports 10.0). */
const WINDOWS_VERSIONS: Readonly<Record<string, string>> = {
	"10.0": "10/11",
	"6.3": "8.1",
	"6.2": "8",
	"6.1": "7",
	"6.0": "Vista",
	"5.2": "XP",
	"5.1": "XP",
};

/** Chrome's reduced User-Agent replaces the Android model with this placeholder. */
const REDUCED_ANDROID_MODEL = "K";

function bounded(value: string | undefined, maxLength: number): string | null {
	const trimmed: string | undefined = value?.trim();
	return trimmed === undefined || trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

/** `15_0_1` → `15.0.1`. */
function dotted(version: string | undefined): string | undefined {
	return version?.replace(/_/g, ".");
}

function firstMatch(patterns: readonly NamedPattern[], userAgent: string): { readonly name: string; readonly version: string | null } | null {
	for (const { name, pattern } of patterns) {
		const match: RegExpExecArray | null = pattern.exec(userAgent);
		if (match !== null) {
			return { name, version: bounded(match.groups?.version, VERSION_MAX_LENGTH) };
		}
	}
	return null;
}

interface ParsedOs {
	readonly name: string;
	readonly version: string | null;
	readonly model: string | null;
	readonly isMobile: boolean;
	readonly isTablet: boolean;
}

function parseOs(userAgent: string): ParsedOs | null {
	const apple = /\((?<model>iPhone|iPad|iPod)\b[^)]*?\bOS (?<version>\d+(?:_\d+)*)/.exec(userAgent);
	if (apple !== null) {
		const model: string = apple.groups?.model ?? "iPhone";
		return {
			name: model === "iPad" ? "iPadOS" : "iOS",
			version: bounded(dotted(apple.groups?.version), VERSION_MAX_LENGTH),
			model,
			isMobile: model !== "iPad",
			isTablet: model === "iPad",
		};
	}
	// Native iOS apps (Expo / React Native) identify through the networking stack.
	if (/\bCFNetwork\/[\d.]+ Darwin\//.test(userAgent)) {
		return { name: "iOS", version: null, model: null, isMobile: true, isTablet: false };
	}
	const android = /\bAndroid (?<version>\d+(?:\.\d+)*)/.exec(userAgent);
	if (android !== null) {
		const modelMatch = /\bAndroid [\d.]+;(?: [a-z]{2}[-_][A-Za-z]{2};)? (?<model>[^;)]+?)(?: Build\/[^;)]*)?\)/.exec(userAgent);
		const model: string | undefined = modelMatch?.groups?.model;
		const isMobile: boolean = /\bMobile\b/.test(userAgent);
		return {
			name: "Android",
			version: bounded(android.groups?.version, VERSION_MAX_LENGTH),
			model: model === REDUCED_ANDROID_MODEL ? null : bounded(model, MODEL_MAX_LENGTH),
			isMobile,
			isTablet: !isMobile,
		};
	}
	// Native Android apps (Expo / React Native) send okhttp's User-Agent.
	if (/^okhttp\//i.test(userAgent)) {
		return { name: "Android", version: null, model: null, isMobile: true, isTablet: false };
	}
	const windows = /\bWindows NT (?<version>\d+\.\d+)/.exec(userAgent);
	if (windows !== null) {
		const raw: string = windows.groups?.version ?? "";
		return { name: "Windows", version: WINDOWS_VERSIONS[raw] ?? raw, model: null, isMobile: false, isTablet: false };
	}
	const mac = /\bMac OS X (?<version>\d+(?:[_.]\d+)*)/.exec(userAgent);
	if (mac !== null) {
		return { name: "macOS", version: bounded(dotted(mac.groups?.version), VERSION_MAX_LENGTH), model: null, isMobile: false, isTablet: false };
	}
	const chromeOs = /\bCrOS \S+ (?<version>\d+(?:\.\d+)*)/.exec(userAgent);
	if (chromeOs !== null) {
		return { name: "ChromeOS", version: bounded(chromeOs.groups?.version, VERSION_MAX_LENGTH), model: null, isMobile: false, isTablet: false };
	}
	if (/\bUbuntu\b/.test(userAgent)) {
		return { name: "Ubuntu", version: null, model: null, isMobile: false, isTablet: false };
	}
	if (/\bLinux\b|\bX11\b/.test(userAgent)) {
		return { name: "Linux", version: null, model: null, isMobile: false, isTablet: false };
	}
	return null;
}

const UNKNOWN_CLIENT: ParsedUserAgent = { browserName: null, browserVersion: null, osName: null, osVersion: null, deviceType: "UNKNOWN", deviceModel: null };

/**
 * Parse one User-Agent. Bots → `BOT`; scripts and API tools → the tool as the
 * "browser" with an `UNKNOWN` device; browsers and native apps → browser, OS,
 * device class (MOBILE / TABLET / DESKTOP) and, when named, the model.
 */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
	const ua: string = userAgent?.trim() ?? "";
	if (ua.length === 0) {
		return UNKNOWN_CLIENT;
	}

	const bot: RegExpExecArray | null = BOT_PATTERN.exec(ua);
	if (bot !== null) {
		const os: ParsedOs | null = parseOs(ua);
		return {
			browserName: bounded(bot.groups?.name, NAME_MAX_LENGTH),
			browserVersion: bounded(bot.groups?.version, VERSION_MAX_LENGTH),
			osName: os?.name ?? null,
			osVersion: os?.version ?? null,
			deviceType: "BOT",
			deviceModel: null,
		};
	}

	const tool = firstMatch(HTTP_CLIENTS, ua);
	if (tool !== null) {
		return { ...UNKNOWN_CLIENT, browserName: tool.name, browserVersion: tool.version };
	}

	const os: ParsedOs | null = parseOs(ua);
	const browser = firstMatch(BROWSERS, ua);
	const deviceType: DeviceType = os === null ? "UNKNOWN" : os.isTablet || /\b(?:Tablet|Kindle|Silk)\b/.test(ua) ? "TABLET" : os.isMobile ? "MOBILE" : "DESKTOP";
	return {
		browserName: browser?.name ?? (/^okhttp\//i.test(ua) ? "okhttp" : /\bCFNetwork\//.test(ua) ? "CFNetwork" : null),
		browserVersion: browser?.version ?? null,
		osName: os?.name ?? null,
		osVersion: os?.version ?? null,
		deviceType,
		deviceModel: os?.model ?? null,
	};
}
