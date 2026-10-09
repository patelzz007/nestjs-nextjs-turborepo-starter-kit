// ============================================
// app-version.ts - the installed app's own version (ADR 033)
// ============================================
// Sent as `X-App-Version` on every request; the API answers a version below
// `MOBILE_MIN_SUPPORTED_VERSION` with 426 and the app shows its blocking update
// screen. A real build reports its native version (expo-application). Inside
// Expo Go (and a development client) `nativeApplicationVersion` is the HOST
// app's version, not this project's, so the version declared in app.config.ts
// (`expoConfig.version`) is used instead.

import { AppVersionSchema, type AppVersion } from "@workspace/shared";
import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";

/** The version could not be determined or is not a semantic version — a build misconfiguration. */
export class InvalidAppVersionError extends Error {
	public constructor(source: string) {
		super(`The app version from ${source} is missing or not a semantic version (app.config.ts → version).`);
		this.name = "InvalidAppVersionError";
	}
}

/** Where the running app's version comes from, as the runtime reports it. */
export interface AppVersionSources {
	readonly executionEnvironment: ExecutionEnvironment;
	readonly nativeApplicationVersion: string | null;
	readonly configVersion: string | undefined;
}

/** Picks and validates the version this build declares. */
export function resolveAppVersion(sources: AppVersionSources): AppVersion {
	const isHostedByExpo = sources.executionEnvironment === ExecutionEnvironment.StoreClient;
	const source = isHostedByExpo ? "app.config.ts (Expo Go / development client)" : "the native build (expo-application)";
	const parsed = AppVersionSchema.safeParse(isHostedByExpo ? sources.configVersion : sources.nativeApplicationVersion);
	if (!parsed.success) {
		throw new InvalidAppVersionError(source);
	}
	return parsed.data;
}

/** The running app's version. */
export function readAppVersion(): AppVersion {
	return resolveAppVersion({
		executionEnvironment: Constants.executionEnvironment,
		nativeApplicationVersion: Application.nativeApplicationVersion,
		configVersion: Constants.expoConfig?.version,
	});
}

/** The native build number (`CFBundleVersion` / `versionCode`) for Settings → About; `null` in Expo Go. */
export function readBuildNumber(): string | null {
	return Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? null : Application.nativeBuildVersion;
}
