import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import {
	DeviceSession,
	MAX_ACTIVE_SESSIONS_PER_USER,
	REFRESH_SUPERSEDED_GRACE_MS,
	type DeviceSessionState,
	type LiveSessionSummary,
} from "../aggregates/device-session.aggregate";
import { CorruptIdentityStateError, RefreshTokenExpiredError, RefreshTokenInvalidError, RefreshTokenRevokedError } from "../errors/identity.errors";
import { DeviceSessionsRevoked } from "../events/identity.events";
import type { SessionDeviceDetails } from "../value-objects/session-device.value-object";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const HOUR_MS = 3_600_000;
const DEVICE: SessionDeviceDetails = {
	clientType: "web",
	browserName: "Firefox",
	browserVersion: "130",
	osName: "macOS",
	osVersion: "15",
	deviceType: "DESKTOP",
	deviceModel: null,
	deviceName: null,
	appVersion: null,
};
const CURRENT = { storedHashIsDigest: true, matchesCurrent: true, matchesPrevious: false };
const PREVIOUS = { storedHashIsDigest: true, matchesCurrent: false, matchesPrevious: true };
const UNKNOWN = { storedHashIsDigest: true, matchesCurrent: false, matchesPrevious: false };

function state(overrides: Partial<DeviceSessionState> = {}): DeviceSessionState {
	return {
		id: "session-1",
		userId: "user-1",
		tokenHash: "hash-2",
		previousTokenHash: "hash-1",
		device: DEVICE,
		signInMethod: "PASSWORD",
		ipAddress: "198.51.100.7",
		lastIpAddress: "198.51.100.7",
		location: null,
		createdAt: NOW,
		lastActiveAt: NOW,
		expiresAt: epochMs(NOW + HOUR_MS),
		isDeleted: false,
		updatedAt: NOW,
		...overrides,
	};
}

describe("DeviceSession.issue and rehydrate", () => {
	it("opens a session that expires after its lifetime, with no predecessor token", () => {
		const session = DeviceSession.issue(
			{ id: "session-1", userId: "user-1", tokenHash: "hash-1", device: DEVICE, ipAddress: null, location: null, signInMethod: "PASSWORD", lifetimeMs: HOUR_MS },
			NOW,
		);

		expect(session.isNew).toBe(true);
		expect(session.snapshot).toMatchObject({ expiresAt: NOW + HOUR_MS, previousTokenHash: null, lastActiveAt: NOW, isDeleted: false });
	});

	it("refuses a stored session without a token hash", () => {
		expect(() => DeviceSession.rehydrate(state({ tokenHash: "" }))).toThrow(CorruptIdentityStateError);
	});
});

describe("DeviceSession.evaluateRefresh", () => {
	it("rotates on the current token", () => {
		expect(DeviceSession.rehydrate(state()).evaluateRefresh(CURRENT, NOW)).toBe("rotate");
	});

	it("treats the immediate predecessor inside the grace window as a benign concurrent refresh", () => {
		expect(DeviceSession.rehydrate(state()).evaluateRefresh(PREVIOUS, epochMs(NOW + REFRESH_SUPERSEDED_GRACE_MS))).toBe("superseded");
	});

	it("treats the predecessor after the grace window, or any other token, as reuse (theft)", () => {
		expect(DeviceSession.rehydrate(state()).evaluateRefresh(PREVIOUS, epochMs(NOW + REFRESH_SUPERSEDED_GRACE_MS + 1))).toBe("reused");
		expect(DeviceSession.rehydrate(state()).evaluateRefresh(UNKNOWN, NOW)).toBe("reused");
		expect(DeviceSession.rehydrate(state({ previousTokenHash: null })).evaluateRefresh(PREVIOUS, NOW)).toBe("reused");
	});

	it("refuses an expired, a revoked and an unverifiable (pre-digest) session", () => {
		expect(() => DeviceSession.rehydrate(state({ expiresAt: epochMs(NOW - 1) })).evaluateRefresh(CURRENT, NOW)).toThrow(RefreshTokenExpiredError);
		expect(() => DeviceSession.rehydrate(state({ isDeleted: true })).evaluateRefresh(CURRENT, NOW)).toThrow(RefreshTokenRevokedError);
		expect(() => DeviceSession.rehydrate(state()).evaluateRefresh({ ...CURRENT, storedHashIsDigest: false }, NOW)).toThrow(RefreshTokenInvalidError);
	});
});

describe("DeviceSession.rotate", () => {
	it("keeps the id and device, moves the current digest to the predecessor slot and records the rotation", () => {
		const session = DeviceSession.rehydrate(state());
		const rotation = { tokenHash: "hash-3", expiresAt: epochMs(NOW + 2 * HOUR_MS), lastIpAddress: null, rotatedAt: epochMs(NOW + 5) };

		session.rotate(rotation);

		expect(session.id).toBe("session-1");
		expect(session.tokenHash).toBe("hash-3");
		expect(session.previousTokenHash).toBe("hash-2");
		expect(session.snapshot).toMatchObject({ lastIpAddress: "198.51.100.7", lastActiveAt: NOW + 5, device: DEVICE });
		expect(session.rotation).toEqual(rotation);
	});

	it("refuses to rotate a revoked session", () => {
		expect(() => {
			DeviceSession.rehydrate(state({ isDeleted: true })).rotate({ tokenHash: "hash-3", expiresAt: NOW, lastIpAddress: null, rotatedAt: NOW });
		}).toThrow(RefreshTokenRevokedError);
	});
});

describe("DeviceSession.classifyLostRotation", () => {
	it("answers missing for a gone, revoked or expired-in-place session", () => {
		expect(DeviceSession.classifyLostRotation(null, "hash-2", NOW)).toBe("missing");
		expect(DeviceSession.classifyLostRotation(state({ isDeleted: true }), "hash-2", NOW)).toBe("missing");
		expect(DeviceSession.classifyLostRotation(state(), "hash-2", NOW)).toBe("missing");
	});

	it("answers superseded when a concurrent refresh just rotated past the expected digest", () => {
		expect(DeviceSession.classifyLostRotation(state({ tokenHash: "hash-3", previousTokenHash: "hash-2" }), "hash-2", NOW)).toBe("superseded");
	});

	it("answers reused when the expected digest is older, or the rotation is outside the grace window", () => {
		expect(DeviceSession.classifyLostRotation(state({ tokenHash: "hash-4", previousTokenHash: "hash-3" }), "hash-2", NOW)).toBe("reused");
		expect(DeviceSession.classifyLostRotation(state({ tokenHash: "hash-3", previousTokenHash: "hash-2" }), "hash-2", epochMs(NOW + REFRESH_SUPERSEDED_GRACE_MS + 1))).toBe(
			"reused",
		);
	});
});

describe("DeviceSession sweep at sign-in (D15)", () => {
	function live(id: string, createdAt: number, expiresAt: number): LiveSessionSummary {
		return { id, createdAt: epochMs(createdAt), expiresAt: epochMs(expiresAt) };
	}

	it("retires expired sessions, then everything beyond the newest sessions the user may keep", () => {
		const sessions: LiveSessionSummary[] = [live("expired", NOW - 10, NOW - 1)];
		for (let index = 0; index <= MAX_ACTIVE_SESSIONS_PER_USER; index += 1) {
			sessions.push(live(`s${String(index)}`, NOW + index, NOW + HOUR_MS));
		}

		const sweep = DeviceSession.sweepAtSignIn(sessions, NOW);

		expect(sweep.expired).toEqual(["expired"]);
		expect(sweep.excess).toEqual(["s0"]);
	});

	it("breaks a creation-time tie by id, so the sweep is deterministic", () => {
		const sessions: LiveSessionSummary[] = Array.from({ length: MAX_ACTIVE_SESSIONS_PER_USER + 1 }, (_unused, index) => live(`s${String(index)}`, NOW, NOW + HOUR_MS));

		expect(DeviceSession.sweepAtSignIn(sessions, NOW).excess).toEqual([`s${String(MAX_ACTIVE_SESSIONS_PER_USER)}`]);
	});

	it("records an event only when it retired something, each reason with its own marker", () => {
		expect(DeviceSession.sweepEvent("user-1", { expired: [], excess: [] }, NOW)).toBeNull();
		expect(DeviceSession.sweepEvent("user-1", { expired: ["a"], excess: [] }, NOW)).toBeInstanceOf(DeviceSessionsRevoked);
		expect(DeviceSession.sweepRevoker("expired")).not.toEqual(DeviceSession.sweepRevoker("excess"));
	});
});

describe("DeviceSession.isLiveFor", () => {
	it("is live only for its own user, while not revoked and not expired", () => {
		expect(DeviceSession.rehydrate(state()).isLiveFor("user-1", NOW)).toBe(true);
		expect(DeviceSession.rehydrate(state()).isLiveFor("user-2", NOW)).toBe(false);
		expect(DeviceSession.rehydrate(state({ isDeleted: true })).isLiveFor("user-1", NOW)).toBe(false);
		expect(DeviceSession.rehydrate(state({ expiresAt: epochMs(NOW - 1) })).isLiveFor("user-1", NOW)).toBe(false);
	});
});
