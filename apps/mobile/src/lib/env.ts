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
// A missing or invalid value is a `ConfigError` the root guard shows on the
// config error screen, naming the variable and an example value.

import { HttpUrlEnvSchema } from "@workspace/shared";
import Constants from "expo-constants";
import { z } from "zod";

/** The API's own development port (apps/api `PORT`, default 8080). */
export const DEFAULT_DEV_API_PORT = 8080;

/** Highest TCP port. */
const MAX_PORT = 65_535;

/** Every public variable the app reads, by name — the config error screen names them exactly. */
export const MobileEnvVariableSchema = z.enum(["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_API_PORT", "EXPO_PUBLIC_IOS_STORE_URL", "EXPO_PUBLIC_ANDROID_STORE_URL"]);

export type MobileEnvVariable = z.output<typeof MobileEnvVariableSchema>;

/** An example value per variable, shown next to the error (never the configured value). */
export const MOBILE_ENV_EXAMPLES: Readonly<Record<MobileEnvVariable, string>> = {
	EXPO_PUBLIC_API_URL: "https://api.example.com",
	EXPO_PUBLIC_API_PORT: "8080",
	EXPO_PUBLIC_IOS_STORE_URL: "https://apps.apple.com/app/id0000000000",
	EXPO_PUBLIC_ANDROID_STORE_URL: "https://play.google.com/store/apps/details?id=com.example.starter",
};

/** An absolute `https://` URL — every address outside development. Trailing slashes stripped. */
const HttpsUrlSchema = HttpUrlEnvSchema.refine((value: string): boolean => value.startsWith("https://"), { error: "must be an https:// URL" });

const PortSchema = z.coerce.number().int().min(1).max(MAX_PORT);

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
}

/** The validated configuration. */
export interface MobileEnv {
	readonly isDevelopment: boolean;
	/** Absolute base URL of the API (no trailing slash). */
	readonly apiBaseUrl: string;
	/** Store pages for the update screen; `null` when not configured (development, or not yet published). */
	readonly iosStoreUrl: string | null;
	readonly androidStoreUrl: string | null;
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

type OptionalUrlResult = { readonly ok: true; readonly url: string | null } | { readonly ok: false };

function parseOptionalStoreUrl(value: string | undefined): OptionalUrlResult {
	if (value === undefined || value.trim().length === 0) {
		return { ok: true, url: null };
	}
	const parsed = HttpsUrlSchema.safeParse(value.trim());
	return parsed.success ? { ok: true, url: parsed.data } : { ok: false };
}

function resolveApiBaseUrl(raw: RawMobileEnv): { readonly ok: true; readonly url: string } | { readonly ok: false; readonly result: MobileEnvResult } {
	const configuredUrl = raw.apiUrl?.trim();
	if (configuredUrl !== undefined && configuredUrl.length > 0) {
		// An explicit address always wins; outside development it must be https.
		const schema = raw.isDevelopment ? HttpUrlEnvSchema : HttpsUrlSchema;
		const parsed = schema.safeParse(configuredUrl);
		return parsed.success ? { ok: true, url: parsed.data } : { ok: false, result: failure("EXPO_PUBLIC_API_URL", parsed.error.issues.at(0)?.message ?? "is invalid") };
	}
	if (!raw.isDevelopment) {
		return { ok: false, result: failure("EXPO_PUBLIC_API_URL", "is required outside development") };
	}
	const port = PortSchema.safeParse(raw.apiPort === undefined || raw.apiPort.trim().length === 0 ? DEFAULT_DEV_API_PORT : raw.apiPort.trim());
	if (!port.success) {
		return { ok: false, result: failure("EXPO_PUBLIC_API_PORT", `must be a whole number between 1 and ${String(MAX_PORT)}`) };
	}
	const host = readDevHost(raw.hostUri);
	if (host === null) {
		return { ok: false, result: failure("EXPO_PUBLIC_API_URL", "is required when Expo does not report the dev machine's address (set it to the API's LAN address)") };
	}
	return { ok: true, url: `http://${host}:${String(port.data)}` };
}

/** Validates the raw inputs into a {@link MobileEnv}, or the first problem found. */
export function resolveMobileEnv(raw: RawMobileEnv): MobileEnvResult {
	const apiBaseUrl = resolveApiBaseUrl(raw);
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
	return {
		ok: true,
		env: { isDevelopment: raw.isDevelopment, apiBaseUrl: apiBaseUrl.url, iosStoreUrl: iosStoreUrl.url, androidStoreUrl: androidStoreUrl.url },
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
	};
}
