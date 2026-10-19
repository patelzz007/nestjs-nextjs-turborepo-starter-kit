import type { SessionLocation } from "@workspace/shared";

import type { SessionLocationResolver } from "./session-location.port";

/**
 * `SESSION_LOCATION_PROVIDER=none` (the default): no GeoIP provider is
 * configured, so no session has a location and clients hide the field.
 * Choosing a provider is a pending decision (docs/adr/README.md).
 */
export class NoneSessionLocationResolver implements SessionLocationResolver {
	public resolve(_ipAddress: string): Promise<SessionLocation | null> {
		return Promise.resolve(null);
	}
}
