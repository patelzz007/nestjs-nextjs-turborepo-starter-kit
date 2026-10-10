// ============================================
// indicators.ts - what the status pills say
// ============================================
// Pure: the connection and session states the AppStatusProvider derives, and
// how each one reads in a pill — compact in the screens' top-right corner,
// full in the app drawer. The same states and copy as the admin topbar's
// NetworkStatusIndicator and SessionStatusBadge.

import { ApiError } from "@workspace/api-client";
import type { SessionStatus } from "@workspace/shared";
import ShieldIcon from "lucide-react-native/icons/shield";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import ShieldXIcon from "lucide-react-native/icons/shield-x";
import WifiIcon from "lucide-react-native/icons/wifi";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";

import type { LucideIcon } from "../../components/icon";
import type { StatusPillTone } from "../../components/status-pill";
import { formatTimeLeft, secondsUntil } from "./session-countdown";

export type Connectivity = "online" | "offline";

/** The fields of expo-network's `NetworkState` that decide connectivity (absent until the OS answers). */
export interface NetworkReading {
	readonly isConnected?: boolean | undefined;
	readonly isInternetReachable?: boolean | undefined;
}

/**
 * Offline only when the OS says so. Before its first answer the app counts as
 * online, as the admin's indicator does: a false "Offline" flash at every
 * start would be worse than a moment's delay before a real one.
 */
export function connectivityOf(reading: NetworkReading): Connectivity {
	return reading.isConnected === false || reading.isInternetReachable === false ? "offline" : "online";
}

/** Why the session check failed: the API refused the token even after a refresh, or it could not be reached. */
export type SessionCheckFailure = "expired" | "unreachable";

export type SessionIndicator =
	| { readonly status: "checking" }
	| { readonly status: "failed"; readonly failure: SessionCheckFailure }
	/** `secondsLeft` is `null` when the token carries no expiry; `refreshed` right after a silent refresh. */
	| { readonly status: "verified"; readonly secondsLeft: number | null; readonly refreshed: boolean };

/** How long the "refreshed" highlight stays after a silent refresh rotated the token. */
export const ROTATION_PULSE_MS = 2_000;

const HTTP_UNAUTHORIZED = 401;

export function sessionCheckFailureOf(error: Error): SessionCheckFailure {
	return error instanceof ApiError && error.statusCode === HTTP_UNAUTHORIZED ? "expired" : "unreachable";
}

export interface SessionIndicatorInputs {
	/** The last `GET /session` answer, or `undefined` before the first one. */
	readonly session: SessionStatus | undefined;
	/** The last check's error, or `null`. */
	readonly error: Error | null;
	readonly nowMs: number;
	/** When the token was last seen to rotate (epoch ms), or `null`. */
	readonly rotatedAtMs: number | null;
}

/**
 * The indicator for the latest check. A session already verified stays
 * verified when a later re-check fails (offline, say): the countdown is
 * computed on the device from the token's expiry, so it is still right.
 */
export function sessionIndicatorOf({ session, error, nowMs, rotatedAtMs }: SessionIndicatorInputs): SessionIndicator {
	if (session === undefined) {
		return error === null ? { status: "checking" } : { status: "failed", failure: sessionCheckFailureOf(error) };
	}
	return {
		status: "verified",
		secondsLeft: session.expiresAt === null ? null : secondsUntil(session.expiresAt, nowMs),
		refreshed: rotatedAtMs !== null && nowMs - rotatedAtMs < ROTATION_PULSE_MS,
	};
}

/** What a StatusPill shows (src/components/status-pill.tsx). */
export interface StatusPillContent {
	readonly icon: LucideIcon;
	/** `null`: the icon alone (compact). */
	readonly label: string | null;
	readonly accessibilityLabel: string;
	readonly tone: StatusPillTone;
	readonly emphasized: boolean;
	readonly pulsing: boolean;
	/** Digits keep a fixed width, so a ticking countdown does not resize the pill. */
	readonly tabularLabel: boolean;
}

/** A pill with no highlight, no breathing and proportional digits — each state turns on what it needs. */
const QUIET: Pick<StatusPillContent, "emphasized" | "pulsing" | "tabularLabel"> = { emphasized: false, pulsing: false, tabularLabel: false };

export function networkPillContent(connectivity: Connectivity, compact: boolean): StatusPillContent {
	if (connectivity === "online") {
		return { ...QUIET, icon: WifiIcon, label: compact ? null : "Online", accessibilityLabel: "Online", tone: "success" };
	}
	return { ...QUIET, icon: WifiOffIcon, label: compact ? null : "Offline", accessibilityLabel: "Offline", tone: "destructive" };
}

const FAILURE_LABELS: Readonly<Record<SessionCheckFailure, { readonly compact: string; readonly full: string; readonly spoken: string }>> = {
	expired: { compact: "Expired", full: "Session expired", spoken: "Session expired, please sign in again" },
	unreachable: { compact: "Check failed", full: "Session check failed", spoken: "Session check failed, network or server error" },
};

export function sessionPillContent(indicator: SessionIndicator, compact: boolean): StatusPillContent {
	switch (indicator.status) {
		case "checking":
			return {
				...QUIET,
				icon: ShieldIcon,
				label: compact ? "Checking…" : "Checking session…",
				accessibilityLabel: "Session status: checking",
				tone: "neutral",
				pulsing: true,
			};
		case "failed": {
			const labels = FAILURE_LABELS[indicator.failure];
			return { ...QUIET, icon: ShieldXIcon, label: compact ? labels.compact : labels.full, accessibilityLabel: labels.spoken, tone: "destructive" };
		}
		case "verified": {
			if (indicator.refreshed) {
				return {
					...QUIET,
					icon: ShieldCheckIcon,
					label: compact ? "Refreshed" : "Token refreshed just now",
					accessibilityLabel: "Session verified, token refreshed just now",
					tone: "success",
					emphasized: true,
				};
			}
			if (indicator.secondsLeft === null) {
				return {
					...QUIET,
					icon: ShieldCheckIcon,
					label: compact ? "Verified" : "Token expiry unknown",
					accessibilityLabel: "Session verified, token expiry unknown",
					tone: "success",
				};
			}
			const timeLeft = formatTimeLeft(indicator.secondsLeft, compact);
			return {
				...QUIET,
				icon: ShieldCheckIcon,
				label: compact ? timeLeft : `Token expires in ${timeLeft}`,
				accessibilityLabel: `Session verified, token expires in ${timeLeft}`,
				tone: "success",
				tabularLabel: compact,
			};
		}
	}
}
