import type { GeographyCachePort } from "../../ports/geography-cache.port";

/** Counts the geography cache drops the service asks for (the cache itself is tested in infrastructure). */
export class RecordingGeographyCache implements GeographyCachePort {
	public invalidations = 0;

	public invalidateAll(): Promise<void> {
		this.invalidations += 1;
		return Promise.resolve();
	}
}
