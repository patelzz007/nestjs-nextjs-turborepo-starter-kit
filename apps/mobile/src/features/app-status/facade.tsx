// ============================================
// facade.tsx - the app status: connection and session (the only module screens import)
// ============================================
// The mobile counterpart of the web shells' NetworkQualityIndicator and the
// admin's SessionStatusBadge. One AppStatusProvider in the (app) layout derives
// both once; the corner pills and the app drawer read them from here.
//
// - Connectivity: expo-network's reading (src/lib/use-network-reading.ts).
// - Connection quality: a NetworkQualityMonitor (packages/shared
//   lib/network-quality) timing the API's `GET /health/ping` — ping, jitter,
//   packet loss and a strong / moderate / weak grade. It tests at once, every
//   minute while the app is in the foreground, on returning to the foreground
//   with an older result, when the connection comes back, and on "Test again";
//   never in the background.
// - Session: `GET /session` — the "very basic protected API". The request goes
//   through the api-client's 401 → single-flight refresh → retry, so a silent
//   refresh shows up as `expiresAt` jumping forward, which lights the pill for
//   ROTATION_PULSE_MS. The countdown ticks on the device from that expiry, and
//   only while the app is in the foreground. The session is checked again when
//   the app returns to the foreground, when the connection comes back, and when
//   the countdown reaches zero — the check that refreshes the expired token.
//
// Two contexts, so the connection pill does not re-render on every tick.

import { NetworkQualityMonitor, type NetworkQualityReading } from "@workspace/shared";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { useAppActive } from "../../lib/use-app-active";
import { useNetworkReading } from "../../lib/use-network-reading";
import { useNow } from "../../lib/use-now";
import { useRisingEdge } from "../../lib/use-rising-edge";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { connectivityOf, sessionIndicatorOf, type SessionIndicator } from "./indicators";
import { apiPingProbe } from "./network-probe";
import { didTokenRotate } from "./session-countdown";

/** The countdown's step. */
const TICK_MS = 1_000;

/** The connection pill and sheet's state. */
export interface NetworkStatus {
	readonly reading: NetworkQualityReading;
	/** A test is running. */
	readonly testing: boolean;
	/** Starts a test now, unless one is running or the device is offline. */
	readonly testAgain: () => void;
}

const NetworkStatusContext = React.createContext<NetworkStatus | null>(null);
NetworkStatusContext.displayName = "NetworkStatusContext";

const SessionIndicatorContext = React.createContext<SessionIndicator | null>(null);
SessionIndicatorContext.displayName = "SessionIndicatorContext";

/** The last expiry seen, and when it last moved forward. */
interface RotationTracker {
	readonly expiresAt: number | null;
	readonly rotatedAtMs: number | null;
}

const NOTHING_SEEN: RotationTracker = { expiresAt: null, rotatedAtMs: null };

export interface AppStatusProviderProps {
	readonly children: React.ReactNode;
}

export function AppStatusProvider({ children }: AppStatusProviderProps): React.JSX.Element {
	const api = useApi();
	const runtime = useReadyRuntime();
	const isActive = useAppActive();
	const isOnline = connectivityOf(useNetworkReading()) === "online";
	const networkStatus = useNetworkStatusMonitor(runtime.env.apiBaseUrl, isOnline, isActive);

	const sessionStatus = api.auth.sessionStatus.useQuery(undefined);
	const session = sessionStatus.data?.data;
	const expiresAt = session?.expiresAt ?? null;

	// A fresh answer is newer than the last tick: count from whichever is later.
	const clockMs = useNow({ intervalMs: TICK_MS, running: isActive && expiresAt !== null });
	const nowMs = Math.max(clockMs, sessionStatus.dataUpdatedAt);

	// Remembered from the previous render (React's "storing information from previous renders"):
	// when the expiry moves forward, the token rotated at the moment that answer arrived.
	const [rotation, setRotation] = React.useState<RotationTracker>(NOTHING_SEEN);
	if (session !== undefined && expiresAt !== rotation.expiresAt) {
		setRotation({ expiresAt, rotatedAtMs: didTokenRotate(rotation.expiresAt, expiresAt) ? sessionStatus.dataUpdatedAt : rotation.rotatedAtMs });
	}

	const indicator = sessionIndicatorOf({ session, error: sessionStatus.error, nowMs, rotatedAtMs: rotation.rotatedAtMs });
	const sessionIndicator = useStableIndicator(indicator);

	const { refetch } = sessionStatus;
	const recheck = React.useCallback((): void => {
		void refetch();
	}, [refetch]);
	const isExpired = sessionIndicator.status === "verified" && sessionIndicator.secondsLeft === 0;

	useRisingEdge(isActive, recheck);
	useRisingEdge(isOnline, recheck);
	useRisingEdge(isExpired && isActive && isOnline, recheck);

	return (
		<NetworkStatusContext.Provider value={networkStatus}>
			<SessionIndicatorContext.Provider value={sessionIndicator}>{children}</SessionIndicatorContext.Provider>
		</NetworkStatusContext.Provider>
	);
}

/** The connection test's monitor for this provider's lifetime, fed the device's connectivity and foreground state. */
function useNetworkStatusMonitor(apiBaseUrl: string, isOnline: boolean, isActive: boolean): NetworkStatus {
	const [monitor] = React.useState<NetworkQualityMonitor>(
		(): NetworkQualityMonitor =>
			new NetworkQualityMonitor({
				probe: apiPingProbe(apiBaseUrl),
				now: (): number => performance.now(),
				clock: (): number => Date.now(),
				online: isOnline,
				visible: isActive,
			}),
	);
	React.useEffect((): (() => void) => {
		monitor.start();
		return (): void => {
			monitor.stop();
		};
	}, [monitor]);
	React.useEffect((): void => {
		monitor.setOnline(isOnline);
	}, [monitor, isOnline]);
	React.useEffect((): void => {
		monitor.setVisible(isActive);
	}, [monitor, isActive]);

	const snapshot = React.useSyncExternalStore(monitor.subscribe, monitor.getSnapshot);
	return React.useMemo((): NetworkStatus => ({ reading: snapshot.reading, testing: snapshot.testing, testAgain: monitor.testNow }), [snapshot, monitor]);
}

/** Keeps the previous object while nothing in it changed, so the pills skip re-rendering. */
function useStableIndicator(next: SessionIndicator): SessionIndicator {
	const [current, setCurrent] = React.useState<SessionIndicator>(next);
	if (!sameIndicator(current, next)) {
		setCurrent(next);
		return next;
	}
	return current;
}

function sameIndicator(a: SessionIndicator, b: SessionIndicator): boolean {
	if (a.status === "verified" && b.status === "verified") {
		return a.secondsLeft === b.secondsLeft && a.refreshed === b.refreshed;
	}
	if (a.status === "failed" && b.status === "failed") {
		return a.failure === b.failure;
	}
	return a.status === b.status;
}

/** Thrown when a component asks for the app status outside AppStatusProvider — a wiring bug. */
export class MissingAppStatusProviderError extends Error {
	public constructor() {
		super("The app status is missing — render inside AppStatusProvider (src/app/(app)/_layout.tsx)");
		this.name = "MissingAppStatusProviderError";
	}
}

export function useNetworkStatus(): NetworkStatus {
	const status = React.use(NetworkStatusContext);
	if (status === null) {
		throw new MissingAppStatusProviderError();
	}
	return status;
}

export function useSessionIndicator(): SessionIndicator {
	const indicator = React.use(SessionIndicatorContext);
	if (indicator === null) {
		throw new MissingAppStatusProviderError();
	}
	return indicator;
}
