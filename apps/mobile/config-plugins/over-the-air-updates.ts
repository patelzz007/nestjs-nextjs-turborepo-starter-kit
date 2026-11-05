// ============================================
// over-the-air-updates.ts - an Expo config plugin for over-the-air updates (enhancement 6.3): EAS Update
// ============================================
// A JavaScript-only fix reaches installed apps without a store release. Each build listens on one channel
// (eas.json: development, preview, production), so a preview update never lands on a store build. The
// runtime version is the native code's fingerprint: an update made for other native code (a new native
// module, an SDK bump) never loads on this build, which needs a store release instead.
//
// It needs the EAS project's id (`EAS_PROJECT_ID`, from `eas init` with your Expo account). Without it,
// updates are off and the app runs the JavaScript it was built with, exactly as before. Registered in
// app.config.ts; read when the config is (every `expo` command, EAS Build).

import type { ExpoConfig } from "expo/config";
import type { ConfigPlugin } from "expo/config-plugins";
import { z } from "zod";

/** EAS Update's address for a project. */
const EAS_UPDATE_URL = "https://u.expo.dev";

/** An EAS project id: a UUID; an empty value is the same as none. */
const EasProjectEnvSchema = z.object({
	EAS_PROJECT_ID: z
		.string()
		.trim()
		.optional()
		.transform((value): string | undefined => (value === "" ? undefined : value))
		.pipe(z.uuid("must be the EAS project's id (a UUID, from `eas init`)").optional()),
});

/** The project id in the environment, or undefined when it isn't set. */
export function readEasProjectId(env: Readonly<Record<string, string | undefined>>): string | undefined {
	const parsed = EasProjectEnvSchema.safeParse({ EAS_PROJECT_ID: env.EAS_PROJECT_ID });
	if (!parsed.success) {
		throw new Error(`Invalid EAS_PROJECT_ID (apps/mobile/app.config.ts) — ${parsed.error.issues.map((issue): string => issue.message).join("; ")}`);
	}
	return parsed.data.EAS_PROJECT_ID;
}

/** The parts of the app config EAS Update sets. */
export type OverTheAirUpdatesConfig = Required<Pick<ExpoConfig, "runtimeVersion" | "updates">> & Pick<ExpoConfig, "extra">;

/**
 * The updates config for a project (or none: off). A launch checks for an update but never waits on it
 * (`fallbackToCacheTimeout: 0`): the app opens on what it has, and the update applies on the next launch.
 */
export function overTheAirUpdates(projectId: string | undefined, extra: ExpoConfig["extra"]): OverTheAirUpdatesConfig {
	const runtimeVersion: ExpoConfig["runtimeVersion"] = { policy: "fingerprint" };
	if (projectId === undefined) {
		return { runtimeVersion, updates: { enabled: false }, ...(extra === undefined ? {} : { extra }) };
	}
	return {
		runtimeVersion,
		updates: { enabled: true, url: `${EAS_UPDATE_URL}/${projectId}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 },
		extra: { ...extra, eas: { projectId } },
	};
}

export interface OverTheAirUpdatesOptions {
	/** `EAS_PROJECT_ID` as app.config.ts read it (unset or empty: updates off). */
	readonly projectId: string | undefined;
}

/** Sets the updates config for the project app.config.ts passes. */
const withOverTheAirUpdates: ConfigPlugin<OverTheAirUpdatesOptions> = (config, options) => ({
	...config,
	...overTheAirUpdates(readEasProjectId({ EAS_PROJECT_ID: options.projectId }), config.extra),
});

export default withOverTheAirUpdates;
