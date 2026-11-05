/**
 * The pieces of `pnpm --filter @workspace/mobile e2e:device` (enhancement 3.7): the Maestro flows in
 * apps/mobile/.maestro against the app on a connected phone or emulator. Pure, so unit-tested without one.
 */

import { z } from "zod";

/** Metro's port: a development build on a phone reaches the dev server through it over USB. */
export const METRO_PORT = 8081;

const PublicConfigSchema = z.object({ android: z.object({ package: z.string().min(1) }) });

/** The app's Android id, from `expo config --type public --json` (read from the app's config, never typed here). */
export function appIdOf(configJson) {
	return PublicConfigSchema.parse(JSON.parse(configJson)).android.package;
}

/** The local Mailpit (`pnpm mailpit`): where the sign-in flow reads an emailed device code, when the API asks for one. */
export const DEFAULT_MAILPIT_URL = "http://localhost:8025";

/** `MAESTRO_MAILPIT_URL` from the environment, or the local default. */
export function mailpitUrlOf(environment) {
	return z.url().default(DEFAULT_MAILPIT_URL).parse(environment.MAESTRO_MAILPIT_URL).replace(/\/$/u, "");
}

/** `maestro test`'s arguments: the flows folder, the app id and Mailpit every flow reads, then the caller's own. */
export function maestroArgs(appId, mailpitUrl, extra) {
	return ["test", ".maestro", "-e", `APP_ID=${appId}`, "-e", `MAILPIT_URL=${mailpitUrl}`, ...extra];
}

/** Maestro's environment: the caller's, with its anonymous analytics and its upsell notices off. */
export function maestroEnv(base) {
	return { ...base, MAESTRO_CLI_NO_ANALYTICS: "1", MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true" };
}

/** `adb reverse`'s arguments: the phone's Metro port to this machine's. */
export function metroLinkArgs() {
	return ["reverse", `tcp:${String(METRO_PORT)}`, `tcp:${String(METRO_PORT)}`];
}
