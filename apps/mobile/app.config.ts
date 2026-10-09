// ============================================
// app.config.ts - the mobile app's identity and native configuration
// ============================================
// Read by the Expo CLI on the developer's machine (and by a native build),
// never bundled into the app. Products built on the starter rename the app by
// setting the MOBILE_* variables, never by editing this file
// (docs/technical/mobile/mobile-app.md §9.3, docs/technical/configuration/frontend.md).
// Every value is validated with zod; a wrong one stops `expo start` / `expo export`
// with the variable's name.

import type { ConfigContext, ExpoConfig } from "expo/config";
import { z } from "zod";

/**
 * The app's own semantic version, sent as `X-App-Version` on every request
 * (ADR 033). Raise it with every store release; the API's
 * `MOBILE_MIN_SUPPORTED_VERSION` is compared against it.
 */
const APP_VERSION = "1.0.0";

/** Longest display name the home screens of both platforms show without truncating. */
const APP_NAME_MAX_LENGTH = 30;

/** An Expo slug: lower-case letters, digits and dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A bundle id valid on BOTH platforms: reverse-DNS segments of letters and
 * digits, each starting with a letter (Android package names forbid dashes,
 * iOS bundle ids forbid underscores — neither is allowed here).
 */
const BUNDLE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+$/;

/** A URL scheme (RFC 3986): a letter, then letters, digits, `+`, `-` or `.`. */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

/** What iOS shows when the app lock first asks for Face ID (real builds only; Expo Go cannot use Face ID). */
const FACE_ID_PERMISSION = "Allow $(PRODUCT_NAME) to use Face ID to unlock the app.";

const AppIdentityEnvSchema = z.object({
	MOBILE_APP_NAME: z.string().trim().min(1).max(APP_NAME_MAX_LENGTH).default("Starter"),
	MOBILE_APP_SLUG: z.string().regex(SLUG_PATTERN, "must be lower-case letters, digits and dashes").default("starter"),
	MOBILE_BUNDLE_ID: z.string().regex(BUNDLE_ID_PATTERN, "must be reverse-DNS segments of letters and digits, e.g. com.example.starter").default("com.example.starter"),
	MOBILE_SCHEME: z.string().regex(SCHEME_PATTERN, "must be a URL scheme: a lower-case letter, then letters, digits, +, - or .").default("starter"),
});

type AppIdentityEnv = z.output<typeof AppIdentityEnvSchema>;

function readAppIdentity(): AppIdentityEnv {
	const parsed = AppIdentityEnvSchema.safeParse({
		MOBILE_APP_NAME: process.env.MOBILE_APP_NAME,
		MOBILE_APP_SLUG: process.env.MOBILE_APP_SLUG,
		MOBILE_BUNDLE_ID: process.env.MOBILE_BUNDLE_ID,
		MOBILE_SCHEME: process.env.MOBILE_SCHEME,
	});
	if (!parsed.success) {
		const problems = parsed.error.issues.map((issue): string => `${issue.path.join(".")}: ${issue.message}`).join("; ");
		throw new Error(`Invalid mobile app identity (apps/mobile/app.config.ts) — ${problems}`);
	}
	return parsed.data;
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
	const identity = readAppIdentity();
	return {
		...config,
		name: identity.MOBILE_APP_NAME,
		slug: identity.MOBILE_APP_SLUG,
		scheme: identity.MOBILE_SCHEME,
		version: APP_VERSION,
		orientation: "portrait",
		// System / Light / Dark is chosen in the app (Settings → Appearance); "automatic" lets it follow the OS.
		userInterfaceStyle: "automatic",
		// The three Next.js apps cover the browser; the Expo web target is off (§2, decision 2).
		platforms: ["ios", "android"],
		ios: {
			bundleIdentifier: identity.MOBILE_BUNDLE_ID,
			supportsTablet: true,
		},
		android: {
			package: identity.MOBILE_BUNDLE_ID,
		},
		plugins: ["expo-router", "expo-secure-store", ["expo-local-authentication", { faceIDPermission: FACE_ID_PERMISSION }]],
	};
}
