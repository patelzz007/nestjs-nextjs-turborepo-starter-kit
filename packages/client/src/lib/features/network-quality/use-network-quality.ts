"use client";

import {
	healthPingUrl,
	INITIAL_NETWORK_QUALITY_SNAPSHOT,
	NETWORK_TEST_INTERVAL_MS,
	NetworkQualityMonitor,
	type LatencyProbe,
	type NetworkQualityReading,
	type NetworkQualitySnapshot,
} from "@workspace/shared";
import * as React from "react";

import { API_BASE_URL } from "../../api/config";

/**
 * The browser's connection indicator state: a `NetworkQualityMonitor`
 * (packages/shared `lib/network-quality`, which holds the measurement, the
 * thresholds and the schedule) fed by the browser's own signals —
 * `navigator.onLine` with its `online` / `offline` events, and the tab's
 * `visibilitychange`, so a hidden tab never tests.
 *
 * The server and the hydration render read "measuring" and "online": the
 * monitor starts in an effect, so the server-rendered shell and the first
 * client render agree, and a false "Offline" flash never shows on load.
 */

/** One request of a test: the full answer of `GET /health/ping`, uncached and without cookies (the route is public). */
export const pingApi: LatencyProbe = async (signal: AbortSignal): Promise<void> => {
	const response = await fetch(healthPingUrl(API_BASE_URL), { cache: "no-store", credentials: "omit", signal });
	if (!response.ok) {
		throw new Error(`GET /health/ping answered ${String(response.status)}`);
	}
	await response.arrayBuffer();
};

export interface UseNetworkQualityOptions {
	/** The request a test times; `pingApi` by default. */
	readonly probe?: LatencyProbe;
	readonly intervalMs?: number;
}

export interface NetworkQualityState {
	readonly reading: NetworkQualityReading;
	/** A test is running. */
	readonly testing: boolean;
	/** Starts a test now, unless one is running or the browser is offline. */
	readonly testAgain: () => void;
}

function serverSnapshot(): NetworkQualitySnapshot {
	return INITIAL_NETWORK_QUALITY_SNAPSHOT;
}

function tabIsVisible(): boolean {
	return document.visibilityState === "visible";
}

export function useNetworkQuality({ probe = pingApi, intervalMs = NETWORK_TEST_INTERVAL_MS }: UseNetworkQualityOptions = {}): NetworkQualityState {
	const [monitor] = React.useState<NetworkQualityMonitor>(
		(): NetworkQualityMonitor => new NetworkQualityMonitor({ probe, intervalMs, now: (): number => performance.now(), clock: (): number => Date.now() }),
	);
	const snapshot = React.useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, serverSnapshot);

	React.useEffect((): (() => void) => {
		const followConnectivity = (): void => {
			monitor.setOnline(navigator.onLine);
		};
		const followVisibility = (): void => {
			monitor.setVisible(tabIsVisible());
		};
		followConnectivity();
		followVisibility();
		monitor.start();
		window.addEventListener("online", followConnectivity);
		window.addEventListener("offline", followConnectivity);
		document.addEventListener("visibilitychange", followVisibility);
		return (): void => {
			window.removeEventListener("online", followConnectivity);
			window.removeEventListener("offline", followConnectivity);
			document.removeEventListener("visibilitychange", followVisibility);
			monitor.stop();
		};
	}, [monitor]);

	return { reading: snapshot.reading, testing: snapshot.testing, testAgain: monitor.testNow };
}
