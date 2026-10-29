// ============================================
// env.ts - the mobile app's public configuration, validated with zod
// ============================================
// The ONLY module that reads `process.env` (lint-enforced). Metro inlines
// `EXPO_PUBLIC_*` values into the bundle at build time — they are PUBLIC: no
// secret is ever configured this way (rules/04, rules/10).
//
// The API address (docs/technical/mobile/mobile-app.md §9.5):
// - development (Expo Go): the dev machine's host that Expo Go loaded the
//   bundle from + `EXPO_PUBLIC_API_PORT` (default the API's dev port). Never
//   `localhost`: on a phone it means the phone.
// - otherwise: `EXPO_PUBLIC_API_URL`, required, an absolute `https://` URL.
// An explicit `EXPO_PUBLIC_API_URL` always wins; in development it may be
// `http://`, and one without a port gets `EXPO_PUBLIC_API_PORT` (default the
// API's dev port): `http://10.0.0.9` → `http://10.0.0.9:8080`.
//
// A test APK for a phone on the same Wi-Fi as the dev machine
// (docs/technical/mobile/building-installable-apps.md): a release build made with
// `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true` also takes an `http://` address on a
// private LAN (10.x, 172.16–31.x, 192.168.x), port rules as in development.
// Never for a store build. The config plugin
// config-plugins/lan-http-api.ts lets that build's Android network stack use
// plain http; every other build keeps the https rule.
//
// The demo logins (ADR 042): `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT` is "true" to offer
// them in a release build too (a test APK), "false" or unset for development
// only. Any other value is a configuration error.
//
// A missing or invalid value is a `ConfigError` the root guard shows on the
// config error screen, naming the variable and an example value.

import { HttpUrlEnvSchema } from "@workspace/shared";

import type { DemoAccount } from "./demo-account-list";
import Constants from "expo-constants";
import { z } from "zod";

/** The API's own development port (apps/api `PORT`, default 8080). */
export const DEFAULT_DEV_API_PORT = 8080;

/** Highest TCP port. */
const MAX_PORT = 65_535;

/** Every public variable the app reads, by name — the config error screen names them exactly. */
export const MobileEnvVariableSchema = z.enum([
	"EXPO_PUBLIC_API_URL",
	"EXPO_PUBLIC_API_PORT",
	"EXPO_PUBLIC_IOS_STORE_URL",
	"EXPO_PUBLIC_ANDROID_STORE_URL",
	"EXPO_PUBLIC_SHOW_DEMO_ACCOUNT",
	"EXPO_PUBLIC_ALLOW_LAN_HTTP_API",
]);

export type MobileEnvVariable = z.output<typeof MobileEnvVariableSchema>;

/** An example value per variable, shown next to the error (never the configured value). */
export const MOBILE_ENV_EXAMPLES: Readonly<Record<MobileEnvVariable, string>> = {
	EXPO_PUBLIC_API_URL: "https://api.example.com",
	EXPO_PUBLIC_API_PORT: "8080",
	EXPO_PUBLIC_IOS_STORE_URL: "https://apps.apple.com/app/id0000000000",
	EXPO_PUBLIC_ANDROID_STORE_URL: "https://play.google.com/store/apps/details?id=com.example.starter",
	EXPO_PUBLIC_SHOW_DEMO_ACCOUNT: "true",
	EXPO_PUBLIC_ALLOW_LAN_HTTP_API: "true",
};

/** An absolute `https://` URL — every address outside development. Trailing slashes stripped. */
const HttpsUrlSchema = HttpUrlEnvSchema.refine((value: string): boolean => value.startsWith("https://"), { error: "must be an https:// URL" });

const PortSchema = z.coerce.number().int().min(1).max(MAX_PORT);

/** An `http://` URL WITHOUT a port: its origin, then the rest (`http://10.0.0.9` + `/api`). IPv6 hosts come bracketed. */
const HTTP_URL_WITHOUT_PORT = /^(?<origin>http:\/\/(?:\[[^\]]+\]|[^/:]+))(?<rest>\/.*)?$/;

/** An IPv4 address, its four parts by name. */
const IPV4_PATTERN = /^(?<first>\d{1,3})\.(?<second>\d{1,3})\.(?<third>\d{1,3})\.(?<fourth>\d{1,3})$/;

/** The host of an `http://` URL (an IPv4 address or a name; no IPv6, which no LAN test needs). */
const HTTP_URL_HOST_PATTERN = /^http:\/\/(?<host>[^/:]+)(?::\d+)?(?:\/.*)?$/;

/** The highest value of one part of an IPv4 address. */
const MAX_IPV4_PART = 255;

/** A private (RFC 1918) IPv4 block: its first part, and the range its second part may take. */
interface PrivateIpv4Block {
	readonly first: number;
	readonly secondFrom: number;
	readonly secondTo: number;
}

/** 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16: the addresses a home or office Wi-Fi hands out. */
const PRIVATE_IPV4_BLOCKS: readonly PrivateIpv4Block[] = [
	{ first: 10, secondFrom: 0, secondTo: MAX_IPV4_PART },
	{ first: 172, secondFrom: 16, secondTo: 31 },
	{ first: 192, secondFrom: 168, secondTo: 168 },
];

/** Whether `host` is an IPv4 address on a private LAN (RFC 1918). */
export function isPrivateLanHost(host: string): boolean {
	const parts = IPV4_PATTERN.exec(host)?.groups;
	if (parts === undefined) {
		return false;
	}
	const values = [parts.first, parts.second, parts.third, parts.fourth].map(Number);
	if (values.some((value: number): boolean => value > MAX_IPV4_PART)) {
		return false;
	}
	const [first, second] = values;
	return PRIVATE_IPV4_BLOCKS.some(
		(block: PrivateIpv4Block): boolean => first === block.first && second !== undefined && second >= block.secondFrom && second <= block.secondTo,
	);
}

/** Whether `url` is `http://` to an address on a private LAN. */
function isPrivateLanHttpUrl(url: string): boolean {
	const host = HTTP_URL_HOST_PATTERN.exec(url)?.groups?.host;
	return host !== undefined && isPrivateLanHost(host);
}

/** `host:port` as Expo reports the dev server (`192.168.1.5:8081`); IPv6 hosts come bracketed. */
const HOST_URI_PATTERN = /^(?<host>\[[^\]]+\]|[^:/]+)(?::(?<port>\d+))?/;

/** Raw inputs of {@link resolveMobileEnv}: what the process and Expo report, unvalidated. */
export interface RawMobileEnv {
	/** `__DEV__`: a development bundle served by the Expo dev server. */
	readonly isDevelopment: boolean;
	/** `Constants.expoConfig.hostUri`: the dev server's `host:port` (development only). */
	readonly hostUri: string | undefined;
	readonly apiUrl: string | undefined;
	readonly apiPort: string | undefined;
	readonly iosStoreUrl: string | undefined;
	readonly androidStoreUrl: string | undefined;
	/** `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT`, as written. */
	readonly showDemoAccount: string | undefined;
	/** `EXPO_PUBLIC_ALLOW_LAN_HTTP_API`, as written. */
	readonly allowLanHttpApi: string | undefined;
}

/** The validated configuration. */
export interface MobileEnv {
	readonly isDevelopment: boolean;
	/** Absolute base URL of the API (no trailing slash). */
	readonly apiBaseUrl: string;
	/** Store pages for the update screen; `null` when not configured (development, or not yet published). */
	readonly iosStoreUrl: string | null;
	readonly androidStoreUrl: string | null;
	/** The sign-in screen offers the demo logins outside development too. */
	readonly showDemoAccounts: boolean;
}

/** Why the configuration is unusable: which variable, and why — never its value. */
export interface MobileEnvIssue {
	readonly variable: MobileEnvVariable;
	readonly message: string;
	readonly example: string;
}

export type MobileEnvResult = { readonly ok: true; readonly env: MobileEnv } | { readonly ok: false; readonly issue: MobileEnvIssue };

function failure(variable: MobileEnvVariable, message: string): MobileEnvResult {
	return { ok: false, issue: { variable, message, example: MOBILE_ENV_EXAMPLES[variable] } };
}

/** The dev machine's host from Expo's `host:port`, or `null` when Expo did not report one. */
export function readDevHost(hostUri: string | undefined): string | null {
	if (hostUri === undefined) {
		return null;
	}
	return HOST_URI_PATTERN.exec(hostUri.trim())?.groups?.host ?? null;
}

/** A yes/no variable: "true" or "false". */
const BooleanFlagSchema = z.enum(["true", "false"]);

/** A yes/no variable: unset (or blank) is "no", otherwise exactly "true" or "false"; `null` when it is anything else. */
function parseBooleanFlag(value: string | undefined): boolean | null {
	const trimmed = value?.trim() ?? "";
	if (trimmed.length === 0) {
		return false;
	}
	const parsed = BooleanFlagSchema.safeParse(trimmed);
	return parsed.success ? parsed.data === "true" : null;
}

type OptionalUrlResult = { readonly ok: true; readonly url: string | null } | { readonly ok: false };

function parseOptionalStoreUrl(value: string | undefined): OptionalUrlResult {
	if (value === undefined || value.trim().length === 0) {
		return { ok: true, url: null };
	}
	const parsed = HttpsUrlSchema.safeParse(value.trim());
	return parsed.success ? { ok: true, url: parsed.data } : { ok: false };
}

type ApiBaseUrlResult = { readonly ok: true; readonly url: string } | { readonly ok: false; readonly result: MobileEnvResult };
type DevPortResult = { readonly ok: true; readonly port: number } | { readonly ok: false; readonly result: MobileEnvResult };

/** `EXPO_PUBLIC_API_PORT`, or the API's own dev port when it is unset. */
function resolveDevApiPort(apiPort: string | undefined): DevPortResult {
	const port = PortSchema.safeParse(apiPort === undefined || apiPort.trim().length === 0 ? DEFAULT_DEV_API_PORT : apiPort.trim());
	return port.success ? { ok: true, port: port.data } : { ok: false, result: failure("EXPO_PUBLIC_API_PORT", `must be a whole number between 1 and ${String(MAX_PORT)}`) };
}

/**
 * The explicit `EXPO_PUBLIC_API_URL`. Outside development it must be https and is used as
 * written — or, in a build made with `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true`, http to a private
 * LAN address. In development (and for that LAN address) an `http://` URL without a port gets
 * `EXPO_PUBLIC_API_PORT` (default the API's dev port) — `http://10.0.0.9` + `8080` →
 * `http://10.0.0.9:8080` — and a port written in the URL wins.
 */
function resolveConfiguredApiUrl(configuredUrl: string, raw: RawMobileEnv, allowLanHttpApi: boolean): ApiBaseUrlResult {
	const lanHttp = !raw.isDevelopment && allowLanHttpApi && isPrivateLanHttpUrl(configuredUrl);
	const httpAllowed = raw.isDevelopment || lanHttp;
	const schema = httpAllowed ? HttpUrlEnvSchema : HttpsUrlSchema;
	const parsed = schema.safeParse(configuredUrl);
	if (!parsed.success) {
		const message = allowLanHttpApi
			? "must be an https:// URL, or an http:// URL to a private LAN address (10.x, 172.16-31.x, 192.168.x)"
			: (parsed.error.issues.at(0)?.message ?? "is invalid");
		return { ok: false, result: failure("EXPO_PUBLIC_API_URL", message) };
	}
	const withoutPort = httpAllowed ? HTTP_URL_WITHOUT_PORT.exec(parsed.data) : null;
	if (withoutPort === null) {
		return { ok: true, url: parsed.data };
	}
	const port = resolveDevApiPort(raw.apiPort);
	if (!port.ok) {
		return port;
	}
	return { ok: true, url: `${withoutPort.groups?.origin ?? ""}:${String(port.port)}${withoutPort.groups?.rest ?? ""}` };
}

function resolveApiBaseUrl(raw: RawMobileEnv, allowLanHttpApi: boolean): ApiBaseUrlResult {
	const configuredUrl = raw.apiUrl?.trim();
	if (configuredUrl !== undefined && configuredUrl.length > 0) {
		// An explicit address always wins over the dev machine's.
		return resolveConfiguredApiUrl(configuredUrl, raw, allowLanHttpApi);
	}
	if (!raw.isDevelopment) {
		return { ok: false, result: failure("EXPO_PUBLIC_API_URL", "is required outside development") };
	}
	const port = resolveDevApiPort(raw.apiPort);
	if (!port.ok) {
		return port;
	}
	const host = readDevHost(raw.hostUri);
	if (host === null) {
		return { ok: false, result: failure("EXPO_PUBLIC_API_URL", "is required when Expo does not report the dev machine's address (set it to the API's LAN address)") };
	}
	return { ok: true, url: `http://${host}:${String(port.port)}` };
}

/** Validates the raw inputs into a {@link MobileEnv}, or the first problem found. */
export function resolveMobileEnv(raw: RawMobileEnv): MobileEnvResult {
	const allowLanHttpApi = parseBooleanFlag(raw.allowLanHttpApi);
	if (allowLanHttpApi === null) {
		return failure("EXPO_PUBLIC_ALLOW_LAN_HTTP_API", `must be ${BooleanFlagSchema.options.join(" or ")}, or left unset`);
	}
	const apiBaseUrl = resolveApiBaseUrl(raw, allowLanHttpApi);
	if (!apiBaseUrl.ok) {
		return apiBaseUrl.result;
	}
	const iosStoreUrl = parseOptionalStoreUrl(raw.iosStoreUrl);
	if (!iosStoreUrl.ok) {
		return failure("EXPO_PUBLIC_IOS_STORE_URL", "must be an https:// URL");
	}
	const androidStoreUrl = parseOptionalStoreUrl(raw.androidStoreUrl);
	if (!androidStoreUrl.ok) {
		return failure("EXPO_PUBLIC_ANDROID_STORE_URL", "must be an https:// URL");
	}
	const showDemoAccounts = parseBooleanFlag(raw.showDemoAccount);
	if (showDemoAccounts === null) {
		return failure("EXPO_PUBLIC_SHOW_DEMO_ACCOUNT", `must be ${BooleanFlagSchema.options.join(" or ")}, or left unset`);
	}
	return {
		ok: true,
		env: {
			isDevelopment: raw.isDevelopment,
			apiBaseUrl: apiBaseUrl.url,
			iosStoreUrl: iosStoreUrl.url,
			androidStoreUrl: androidStoreUrl.url,
			showDemoAccounts,
		},
	};
}

/**
 * Reads the app's environment. Each `process.env.EXPO_PUBLIC_…` is written out
 * literally: Metro only inlines literal reads.
 */
export function readRawMobileEnv(): RawMobileEnv {
	return {
		isDevelopment: __DEV__,
		hostUri: Constants.expoConfig?.hostUri,
		apiUrl: process.env.EXPO_PUBLIC_API_URL,
		apiPort: process.env.EXPO_PUBLIC_API_PORT,
		iosStoreUrl: process.env.EXPO_PUBLIC_IOS_STORE_URL,
		androidStoreUrl: process.env.EXPO_PUBLIC_ANDROID_STORE_URL,
		showDemoAccount: process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNT,
		allowLanHttpApi: process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP_API,
	};
}

/**
 * Whether Settings offers "Sign out and replay onboarding" (ADR 041): in a development build, and in
 * a test build — one made with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true`, the same internal-test-APK
 * signal the demo logins use — never in a store build. Onboarding's "seen" flag lives in the
 * Keychain / Keystore, which outlives a reinstall, so a tester has no other way to see it again.
 */
export function canReplayOnboarding(env: Pick<MobileEnv, "isDevelopment" | "showDemoAccounts">): boolean {
	return env.isDevelopment || env.showDemoAccounts;
}

const NO_DEMO_ACCOUNTS: readonly DemoAccount[] = [];

/**
 * The seeded demo logins this bundle carries: always in development, and in a
 * release build only when it was built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` —
 * for an internal test APK, never a store build (ADR 042, amended 2026-10-29).
 *
 * The test must stay exactly this shape, and the import inside it. Metro folds
 * it at build time: `__DEV__` becomes `false` in a release bundle, and Expo
 * inlines the variable as a string (or `undefined` when it is unset), so
 * without the flag the branch, the import and the passwords are removed before
 * the bundle is assembled. A top-level import, a helper function or a variable
 * in place of either literal would ship the list in every build.
 */
export async function loadBundledDemoAccounts(): Promise<readonly DemoAccount[]> {
	if (__DEV__ || process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNT === "true") {
		return (await import("./demo-account-list")).MOBILE_DEMO_ACCOUNTS;
	}
	return NO_DEMO_ACCOUNTS;
}
