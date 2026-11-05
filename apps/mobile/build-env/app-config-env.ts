// ============================================
// build-env/app-config-env.ts - the build's configuration, validated with zod
// ============================================
// The build-time twin of src/lib/env.ts. app.config.ts runs on the build machine (the Expo CLI, a native
// build, EAS Build), never in the app, and its values become the native project: the app's name and ids,
// its URL scheme, Firebase's files, EAS Update's project, the LAN-http permission and the iOS passkey
// entitlement. This module is the ONLY build-side reader of `process.env` (lint-enforced, oxlint.config.mts);
// src/lib/env.ts is the only app-side one. Every variable is declared once below; a wrong value stops
// `expo start` / `expo export` / a build with every wrong variable's name.

import { z } from "zod";

/** Longest display name the home screens of both platforms show without truncating. */
export const APP_NAME_MAX_LENGTH = 30;

/** An Expo slug: lower-case letters, digits and dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A bundle id valid on BOTH platforms: reverse-DNS segments of letters and digits, each starting with a letter
 * (Android package names forbid dashes, iOS bundle ids forbid underscores; neither is allowed here).
 */
const BUNDLE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+$/;

/** A URL scheme (RFC 3986): a letter, then letters, digits, `+`, `-` or `.`. */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

/** A variable left empty (`FOO=`) is the same as one not set. */
function blankAsUnset(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed === "" ? undefined : trimmed;
}

/** An optional variable before its own rule: trimmed, and empty as unset. Each field pipes it into that rule. */
const OptionalVariableSchema = z.string().optional().transform(blankAsUnset);

const AppConfigEnvSchema = z.object({
	// The app's identity (docs/technical/mobile/mobile-app.md §9.3): products rename the app here, never in app.config.ts.
	MOBILE_APP_NAME: z.string().trim().min(1).max(APP_NAME_MAX_LENGTH).default("Starter"),
	MOBILE_APP_SLUG: z.string().regex(SLUG_PATTERN, "must be lower-case letters, digits and dashes").default("starter"),
	MOBILE_BUNDLE_ID: z.string().regex(BUNDLE_ID_PATTERN, "must be reverse-DNS segments of letters and digits, e.g. com.example.starter").default("com.example.starter"),
	MOBILE_SCHEME: z.string().regex(SCHEME_PATTERN, "must be a URL scheme: a lower-case letter, then letters, digits, +, - or .").default("starter"),
	/**
	 * The passkey domain (ADR 080): the API's `WEBAUTHN_RP_ID`. iOS offers a site's passkeys only to an app whose
	 * entitlements name it (`webcredentials:<domain>`, matched by the site's apple-app-site-association); Android
	 * needs nothing here (the site's assetlinks.json names the app). Unset: no association.
	 */
	MOBILE_PASSKEY_DOMAIN: OptionalVariableSchema.pipe(z.hostname("must be a host name, e.g. example.com").optional()),
	/**
	 * A test APK that talks to the API on the developer's machine over the LAN in plain http
	 * (config-plugins/lan-http-api.ts; src/lib/env.ts reads the same variable in the app). Read here because the
	 * permission is written into the generated manifest at prebuild.
	 */
	EXPO_PUBLIC_ALLOW_LAN_HTTP_API: OptionalVariableSchema.pipe(z.enum(["true", "false"], "must be true or false, or left unset").optional()).transform(
		(flag): boolean => flag === "true",
	),
	/**
	 * Firebase's Android config for direct FCM push (ADR 070): a path (EAS's file-secret convention; locally e.g.
	 * `./google-services.json`, never committed). Unset: no FCM, and the app registers no push device.
	 */
	GOOGLE_SERVICES_JSON: OptionalVariableSchema,
	/** Firebase's iOS config for crash reporting (enhancement 6.2): a path, never committed. */
	GOOGLE_SERVICES_PLIST: OptionalVariableSchema,
	/** The EAS project (enhancement 6.3, `eas init`): turns over-the-air updates on. Unset: updates off. */
	EAS_PROJECT_ID: OptionalVariableSchema.pipe(z.uuid("must be the EAS project's id (a UUID, from `eas init`)").optional()),
});

export type AppConfigEnv = z.output<typeof AppConfigEnvSchema>;

/** The variables this module reads, by name. */
export type AppConfigEnvInput = Readonly<Partial<Record<keyof z.input<typeof AppConfigEnvSchema>, string | undefined>>>;

/** Validates the build's variables; throws one error naming every wrong one. */
export function parseAppConfigEnv(input: AppConfigEnvInput): AppConfigEnv {
	const parsed = AppConfigEnvSchema.safeParse(input);
	if (!parsed.success) {
		const problems = parsed.error.issues.map((issue): string => `${issue.path.join(".")}: ${issue.message}`).join("; ");
		throw new Error(`Invalid mobile build configuration (apps/mobile/build-env/app-config-env.ts) — ${problems}`);
	}
	return parsed.data;
}

/** The build's variables, from this process's environment. Each is named literally, so the list above is the whole surface. */
export function readAppConfigEnv(): AppConfigEnv {
	return parseAppConfigEnv({
		MOBILE_APP_NAME: process.env.MOBILE_APP_NAME,
		MOBILE_APP_SLUG: process.env.MOBILE_APP_SLUG,
		MOBILE_BUNDLE_ID: process.env.MOBILE_BUNDLE_ID,
		MOBILE_SCHEME: process.env.MOBILE_SCHEME,
		MOBILE_PASSKEY_DOMAIN: process.env.MOBILE_PASSKEY_DOMAIN,
		EXPO_PUBLIC_ALLOW_LAN_HTTP_API: process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP_API,
		GOOGLE_SERVICES_JSON: process.env.GOOGLE_SERVICES_JSON,
		GOOGLE_SERVICES_PLIST: process.env.GOOGLE_SERVICES_PLIST,
		EAS_PROJECT_ID: process.env.EAS_PROJECT_ID,
	});
}

/** The iOS associated domains a passkey domain needs, or none. */
export function passkeyAssociatedDomains(domain: string | undefined): string[] {
	return domain === undefined ? [] : [`webcredentials:${domain}`];
}
