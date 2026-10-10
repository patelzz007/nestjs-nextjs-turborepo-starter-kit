import { ApiError } from "@workspace/api-client";
import { SessionStatusSchema, type SessionStatus } from "@workspace/shared";
import ShieldIcon from "lucide-react-native/icons/shield";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import ShieldXIcon from "lucide-react-native/icons/shield-x";
import WifiIcon from "lucide-react-native/icons/wifi";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";

import { connectivityOf, networkPillContent, ROTATION_PULSE_MS, sessionCheckFailureOf, sessionIndicatorOf, sessionPillContent, type SessionIndicator } from "./indicators";

const NOW_MS = 1_791_504_000_000;

function session(expiresAt: number | null): SessionStatus {
	return SessionStatusSchema.parse({ userId: "user-1", email: "member@example.com", fullName: "Alex Morgan", expiresAt, checkedAt: NOW_MS });
}

describe("connectivityOf", () => {
	it("is online with a connection that reaches the internet", () => {
		expect(connectivityOf({ isConnected: true, isInternetReachable: true })).toBe("online");
	});

	it("is offline without a connection", () => {
		expect(connectivityOf({ isConnected: false, isInternetReachable: false })).toBe("offline");
	});

	it("is offline on a connection that does not reach the internet (Android captive network)", () => {
		expect(connectivityOf({ isConnected: true, isInternetReachable: false })).toBe("offline");
	});

	it("counts as online before the OS has answered", () => {
		expect(connectivityOf({})).toBe("online");
	});
});

describe("sessionCheckFailureOf", () => {
	it("reads a 401 as an expired session", () => {
		expect(sessionCheckFailureOf(new ApiError({ message: "Expired", error: "ACCESS_TOKEN_EXPIRED", statusCode: 401 }))).toBe("expired");
	});

	it("reads anything else as an unreachable server", () => {
		expect(sessionCheckFailureOf(new ApiError({ message: "Down", error: "SERVICE_UNAVAILABLE", statusCode: 503 }))).toBe("unreachable");
		expect(sessionCheckFailureOf(new TypeError("Network request failed"))).toBe("unreachable");
	});
});

describe("sessionIndicatorOf", () => {
	it("is checking before the first answer", () => {
		expect(sessionIndicatorOf({ session: undefined, error: null, nowMs: NOW_MS, rotatedAtMs: null })).toEqual({ status: "checking" });
	});

	it("fails when the first check fails", () => {
		expect(sessionIndicatorOf({ session: undefined, error: new TypeError("Network request failed"), nowMs: NOW_MS, rotatedAtMs: null })).toEqual({
			status: "failed",
			failure: "unreachable",
		});
	});

	it("counts down to the token's expiry", () => {
		expect(sessionIndicatorOf({ session: session(NOW_MS + 872_000), error: null, nowMs: NOW_MS, rotatedAtMs: null })).toEqual({
			status: "verified",
			secondsLeft: 872,
			refreshed: false,
		});
	});

	it("stays verified when a later re-check fails — the countdown is computed on the device", () => {
		expect(sessionIndicatorOf({ session: session(NOW_MS + 60_000), error: new TypeError("Network request failed"), nowMs: NOW_MS, rotatedAtMs: null })).toEqual({
			status: "verified",
			secondsLeft: 60,
			refreshed: false,
		});
	});

	it("has no countdown for a token without expiry", () => {
		expect(sessionIndicatorOf({ session: session(null), error: null, nowMs: NOW_MS, rotatedAtMs: null })).toEqual({ status: "verified", secondsLeft: null, refreshed: false });
	});

	it("is refreshed for the pulse's duration after a rotation, then not", () => {
		const inputs = { session: session(NOW_MS + 900_000), error: null, rotatedAtMs: NOW_MS };
		expect(sessionIndicatorOf({ ...inputs, nowMs: NOW_MS + ROTATION_PULSE_MS - 1 })).toMatchObject({ refreshed: true });
		expect(sessionIndicatorOf({ ...inputs, nowMs: NOW_MS + ROTATION_PULSE_MS })).toMatchObject({ refreshed: false });
	});
});

describe("networkPillContent", () => {
	it("is a green wifi pill online — labelled in full, the icon alone when compact", () => {
		expect(networkPillContent("online", false)).toMatchObject({ icon: WifiIcon, label: "Online", accessibilityLabel: "Online", tone: "success" });
		expect(networkPillContent("online", true)).toMatchObject({ icon: WifiIcon, label: null, accessibilityLabel: "Online" });
	});

	it("is a red wifi-off pill offline", () => {
		expect(networkPillContent("offline", false)).toMatchObject({ icon: WifiOffIcon, label: "Offline", accessibilityLabel: "Offline", tone: "destructive" });
		expect(networkPillContent("offline", true)).toMatchObject({ label: null, accessibilityLabel: "Offline" });
	});
});

describe("sessionPillContent", () => {
	it("breathes while checking", () => {
		expect(sessionPillContent({ status: "checking" }, true)).toMatchObject({ icon: ShieldIcon, label: "Checking…", tone: "neutral", pulsing: true });
		expect(sessionPillContent({ status: "checking" }, false)).toMatchObject({ label: "Checking session…" });
	});

	it("names the failure, shortly when compact and in full for screen readers", () => {
		expect(sessionPillContent({ status: "failed", failure: "unreachable" }, true)).toMatchObject({
			icon: ShieldXIcon,
			label: "Check failed",
			accessibilityLabel: "Session check failed, network or server error",
			tone: "destructive",
		});
		expect(sessionPillContent({ status: "failed", failure: "expired" }, false)).toMatchObject({
			label: "Session expired",
			accessibilityLabel: "Session expired, please sign in again",
		});
	});

	it("shows the countdown — bare and fixed-width when compact, as a sentence in full", () => {
		const indicator: SessionIndicator = { status: "verified", secondsLeft: 872, refreshed: false };
		expect(sessionPillContent(indicator, true)).toMatchObject({
			icon: ShieldCheckIcon,
			label: "14m 32s",
			accessibilityLabel: "Session verified, token expires in 14m 32s",
			tone: "success",
			tabularLabel: true,
		});
		expect(sessionPillContent(indicator, false)).toMatchObject({ label: "Token expires in 14m 32s", tabularLabel: false });
	});

	it("highlights a silent refresh", () => {
		expect(sessionPillContent({ status: "verified", secondsLeft: 900, refreshed: true }, true)).toMatchObject({ label: "Refreshed", emphasized: true, tone: "success" });
		expect(sessionPillContent({ status: "verified", secondsLeft: 900, refreshed: true }, false)).toMatchObject({ label: "Token refreshed just now" });
	});

	it("says when the token has no expiry", () => {
		expect(sessionPillContent({ status: "verified", secondsLeft: null, refreshed: false }, false)).toMatchObject({ label: "Token expiry unknown" });
	});
});
