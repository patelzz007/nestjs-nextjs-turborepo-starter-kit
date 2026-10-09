import type { SessionLocation } from "@workspace/shared";

/**
 * Where a device session signed in from, by its IP address
 * (docs/technical/mobile/mobile-app.md §8.7). An adapter wraps one GeoIP
 * provider; `SESSION_LOCATION_PROVIDER` selects it at boot. Answers `null`
 * when the provider knows nothing about the address. It may throw or be slow:
 * the caller ({@link SessionLocationLookupService}) bounds it with a timeout
 * and a failure never blocks a sign-in.
 */
export interface SessionLocationResolver {
	resolve(ipAddress: string): Promise<SessionLocation | null>;
}

/** Nest injection token of the configured {@link SessionLocationResolver}. */
export const SESSION_LOCATION_RESOLVER: unique symbol = Symbol("SESSION_LOCATION_RESOLVER");
