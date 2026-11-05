// ============================================
// build-identity.ts - which build is running, and since when (owner, 2026-11-05)
// ============================================
// Shown app wide (the drawer's footer, the sign-in panel, Settings → About) so anyone holding the
// phone can tell a development, preview or production build apart, with its version and the moment
// its code was made. Pure: the device adapter (`build-identity-device.ts`) reads the sources.
//
// The build type: a development (debug) build is `__DEV__`; a release build names its EAS Update
// channel (one per EAS profile, eas.json), so a channel of `preview` or `production` is that build.
// A release with no channel was built on a machine without EAS (`expo run --variant release`):
// `local`.
//
// The moment: the running update's `createdAt` is when its JavaScript was bundled. For the update
// embedded in the APK that is the build; after an over-the-air update it is the update's publish.
// Development builds run no update (expo-updates is off), so the app's install time stands in.

import { z } from "zod";

export const BuildKindSchema = z.enum(["development", "preview", "production", "local"]);
export type BuildKind = z.output<typeof BuildKindSchema>;

/** The EAS profiles whose channel names a build type. */
const ChannelBuildKindSchema = BuildKindSchema.extract(["development", "preview", "production"]);

export interface BuildKindSources {
	/** `__DEV__`: a debug build or Expo Go, loading JavaScript from Metro. */
	readonly isDevelopment: boolean;
	/** The EAS Update channel the build was made for; `null` without one. */
	readonly channel: string | null;
}

/** Development when debugging, else the channel's profile, else a local release. */
export function resolveBuildKind(sources: BuildKindSources): BuildKind {
	if (sources.isDevelopment) {
		return "development";
	}
	const parsed = ChannelBuildKindSchema.safeParse(sources.channel);
	return parsed.success ? parsed.data : "local";
}

export type BuildMomentKind = "built" | "updated" | "installed";

/** When the running code was made (or, failing that, installed). */
export interface BuildMoment {
	readonly kind: BuildMomentKind;
	readonly at: Date;
}

export interface BuildMomentSources {
	/** The running update's `createdAt`; `null` when expo-updates is off. */
	readonly runningUpdateCreatedAt: Date | null;
	/** The running update is the one inside the build, not one downloaded since. */
	readonly isEmbeddedLaunch: boolean;
	/** When this app was installed or last updated from an APK; `null` when unknown (Expo Go). */
	readonly installedAt: Date | null;
}

/** What the runtime knows about the build it runs in (read once at start; the install time on demand). */
export interface BuildIdentity {
	readonly kind: BuildKind;
	readonly runningUpdateCreatedAt: Date | null;
	readonly isEmbeddedLaunch: boolean;
	/** The install (or last APK update) time; `null` where it would not be this app's (Expo Go). */
	readonly readInstalledAt: () => Promise<Date | null>;
}

/** The running update's moment (built, or updated over the air), else the install time, else none. */
export function resolveBuildMoment(sources: BuildMomentSources): BuildMoment | null {
	if (sources.runningUpdateCreatedAt !== null) {
		return { kind: sources.isEmbeddedLaunch ? "built" : "updated", at: sources.runningUpdateCreatedAt };
	}
	return sources.installedAt === null ? null : { kind: "installed", at: sources.installedAt };
}

/**
 * "5 Nov 2026, 6:12 pm GMT+8": in the phone's own time zone (no `timeZone` given), named, so a
 * screenshot shared across zones still reads right.
 */
export function formatBuildMoment(at: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(at);
}
