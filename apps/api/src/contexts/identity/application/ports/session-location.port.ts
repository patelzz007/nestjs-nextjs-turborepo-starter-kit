import type { SessionLocation } from "@workspace/shared";

/** Best-effort, bounded GeoIP lookup of a sign-in (never fails a sign-in). */
export interface SessionLocationLookupPort {
	lookup(ipAddress: string | null): Promise<SessionLocation | null>;
}
