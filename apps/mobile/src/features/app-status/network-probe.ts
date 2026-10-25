// One request of a connection test (packages/shared lib/network-quality): the
// full answer of the API's `GET /health/ping`, uncached and without cookies
// (the route is public). A non-200 answer fails, so the request counts as lost.

import { healthPingUrl, type LatencyProbe } from "@workspace/shared";

export function apiPingProbe(apiBaseUrl: string): LatencyProbe {
	const url = healthPingUrl(apiBaseUrl);
	return async (signal: AbortSignal): Promise<void> => {
		const response = await fetch(url, { cache: "no-store", credentials: "omit", signal });
		if (!response.ok) {
			throw new Error(`GET /health/ping answered ${String(response.status)}`);
		}
		await response.arrayBuffer();
	};
}
