import { beforeEach, describe, expect, it } from "vitest";
import { epochMs, type ImpersonateServiceResponse, type RefreshResponse, type StopImpersonationServiceResponse } from "@workspace/shared";

import { REFRESH_SUPERSEDED_GRACE_MS } from "../../domain/aggregates/device-session.aggregate";
import {
	AccountInactiveError,
	DeviceSessionNotFoundError,
	ImpersonationAlreadyActiveError,
	ImpersonationGrantRequiredError,
	ImpersonationSessionInvalidError,
	ImpersonatorNotEligibleError,
	MfaStepUpRequiredError,
	RefreshTokenInvalidError,
	RefreshTokenRevokedError,
	RefreshTokenSupersededError,
	SessionRevokeDuringImpersonationError,
	TokenTheftDetectedError,
} from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import { LogOutAllDevicesCommand } from "../commands/log-out-all-devices/log-out-all-devices.command";
import { LogOutAllDevicesHandler } from "../commands/log-out-all-devices/log-out-all-devices.handler";
import { LogOutDeviceCommand } from "../commands/log-out-device/log-out-device.command";
import { LogOutDeviceHandler } from "../commands/log-out-device/log-out-device.handler";
import { RefreshSessionCommand } from "../commands/refresh-session/refresh-session.command";
import { RefreshSessionHandler } from "../commands/refresh-session/refresh-session.handler";
import { RevokeMySessionCommand } from "../commands/revoke-my-session/revoke-my-session.command";
import { RevokeMySessionHandler } from "../commands/revoke-my-session/revoke-my-session.handler";
import { StartImpersonationCommand } from "../commands/start-impersonation/start-impersonation.command";
import type { ImpersonationTenantFacts } from "../ports/impersonation-tenant-facts.port";
import type { ApprovedSupportGrant } from "../../domain/policies/impersonation-start.policy";
import { StartImpersonationHandler } from "../commands/start-impersonation/start-impersonation.handler";
import { StopImpersonationCommand } from "../commands/stop-impersonation/stop-impersonation.command";
import { StopImpersonationHandler } from "../commands/stop-impersonation/stop-impersonation.handler";
import {
	FakeCredentialCrypto,
	FakeIdentityTokens,
	FixedClock,
	FixedGrants,
	InMemoryIdentityStore,
	NOW,
	RecordingTelemetry,
	SequentialIds,
	TEST_DEVICE,
	TEST_SETTINGS,
	accountState,
	refreshClaims,
	anonymousActor,
	sessionState,
	userActor,
} from "./fakes/identity.fakes";

const USER_ID = "user-1";
const ADMIN_ID = "admin-1";
const SESSION_ID = "session-1";

let store: InMemoryIdentityStore;
let clock: FixedClock;
let tokens: FakeIdentityTokens;
let telemetry: RecordingTelemetry;

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	tokens = new FakeIdentityTokens();
	telemetry = new RecordingTelemetry();
	store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of("jane@example.com") }));
	store.sessions.seed(sessionState({ id: SESSION_ID, userId: USER_ID }));
});

describe("RefreshSessionHandler", () => {
	function handler(): RefreshSessionHandler {
		return new RefreshSessionHandler(store.uow, new FakeCredentialCrypto(), tokens, new FixedGrants(), telemetry, TEST_SETTINGS, clock);
	}

	function refresh(rawRefreshToken: string, sessionId: string = SESSION_ID): Promise<RefreshResponse> {
		return handler().execute(
			new RefreshSessionCommand(anonymousActor(), {
				userId: USER_ID,
				sessionId,
				rawRefreshToken,
				device: { device: TEST_DEVICE, ipAddress: "203.0.113.9", userAgent: "Firefox" },
			}),
		);
	}

	it("rotates the session in place: same id, new digest, the old one kept as predecessor", async () => {
		await expect(refresh(`refresh:${SESSION_ID}:0`)).resolves.toEqual({ accessToken: `access:${USER_ID}:${SESSION_ID}:full`, refreshToken: `refresh:${SESSION_ID}:1` });

		const row = store.sessions.rows.get(SESSION_ID);
		expect(row).toMatchObject({ tokenHash: `digest:refresh:${SESSION_ID}:1`, previousTokenHash: `digest:refresh:${SESSION_ID}:0`, lastIpAddress: "203.0.113.9" });
		expect(store.eventNames()).toEqual(["identity.DeviceSessionRotated"]);
	});

	it("answers superseded for the predecessor inside the grace window, changing nothing", async () => {
		await refresh(`refresh:${SESSION_ID}:0`);
		store.eventNames();

		await expect(refresh(`refresh:${SESSION_ID}:0`)).rejects.toBeInstanceOf(RefreshTokenSupersededError);

		expect(store.sessions.rows.get(SESSION_ID)?.isDeleted).toBe(false);
		expect(telemetry.actions).toEqual([expect.objectContaining({ action: "refresh", error: "REFRESH_TOKEN_SUPERSEDED" })]);
	});

	it("treats reuse as theft: every session revoked and the token generation moved, committed before refusing", async () => {
		store.sessions.seed(sessionState({ id: "session-2", userId: USER_ID }));
		await refresh(`refresh:${SESSION_ID}:0`);
		clock.advance(REFRESH_SUPERSEDED_GRACE_MS + 1);
		store.eventNames();

		await expect(refresh(`refresh:${SESSION_ID}:0`)).rejects.toBeInstanceOf(TokenTheftDetectedError);

		expect(store.sessions.revokerOf(SESSION_ID)).toBe("system:rotation-reuse");
		expect(store.sessions.revokerOf("session-2")).toBe("system:rotation-reuse");
		expect(store.accounts.rows.get(USER_ID)?.tokenVersion).toEqual(TokenVersion.of(2));
		expect(store.eventNames()).toEqual(["identity.RefreshTokenReuseDetected", "identity.DeviceSessionsRevoked"]);
		expect(store.uow.committed).toHaveLength(2);
	});

	it("refuses a session of another user, and an inactive account", async () => {
		store.sessions.seed(sessionState({ id: "foreign", userId: "user-2" }));
		await expect(refresh("refresh:foreign:0", "foreign")).rejects.toBeInstanceOf(RefreshTokenInvalidError);

		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of("jane@example.com"), isActive: false }));
		await expect(refresh(`refresh:${SESSION_ID}:0`)).rejects.toBeInstanceOf(AccountInactiveError);
	});

	it("issues a restricted token while the account has not verified its email", async () => {
		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of("jane@example.com"), emailVerifiedAt: null }));

		await expect(refresh(`refresh:${SESSION_ID}:0`)).resolves.toMatchObject({ accessToken: `access:${USER_ID}:${SESSION_ID}:restricted` });
	});

	it("classifies a rotation lost to a concurrent revocation as missing (invalid)", async () => {
		store.sessions.revokeBeforeNextRotation(SESSION_ID);

		await expect(refresh(`refresh:${SESSION_ID}:0`)).rejects.toBeInstanceOf(RefreshTokenInvalidError);
	});
});

describe("LogOutDeviceHandler and LogOutAllDevicesHandler", () => {
	it("revokes the caller's own session once, recording who revoked it", async () => {
		const handler = new LogOutDeviceHandler(store.uow, telemetry, clock);

		await handler.execute(new LogOutDeviceCommand(userActor(USER_ID), { userId: USER_ID, sessionId: SESSION_ID }));
		await handler.execute(new LogOutDeviceCommand(userActor(USER_ID), { userId: USER_ID, sessionId: SESSION_ID }));

		expect(store.sessions.revokerOf(SESSION_ID)).toBe(USER_ID);
		expect(store.eventNames()).toEqual(["identity.DeviceSessionSignedOut", "identity.DeviceSessionsRevoked"]);
		expect(telemetry.actions).toEqual([expect.objectContaining({ action: "logout-device", userId: USER_ID })]);
	});

	it("signs every device out and moves the token generation", async () => {
		store.sessions.seed(sessionState({ id: "session-2", userId: USER_ID }));

		await new LogOutAllDevicesHandler(store.uow, clock).execute(new LogOutAllDevicesCommand(userActor(USER_ID), { userId: USER_ID }));

		expect(store.sessions.revokerOf(SESSION_ID)).toBe(USER_ID);
		expect(store.sessions.revokerOf("session-2")).toBe(USER_ID);
		expect(store.accounts.rows.get(USER_ID)?.tokenVersion).toEqual(TokenVersion.of(2));
		expect(store.eventNames()).toEqual(["identity.AllDeviceSessionsSignedOut", "identity.DeviceSessionsRevoked"]);
	});
});

describe("RevokeMySessionHandler", () => {
	const handler = (): RevokeMySessionHandler => new RevokeMySessionHandler(store.uow, clock);

	it("says whether the revoked session was the one making the request", async () => {
		store.sessions.seed(sessionState({ id: "session-2", userId: USER_ID }));

		await expect(handler().execute(new RevokeMySessionCommand(userActor(USER_ID), { sessionId: "session-2" }))).resolves.toEqual({
			message: "Device signed out",
			revokedCurrentSession: false,
		});
		await expect(handler().execute(new RevokeMySessionCommand(userActor(USER_ID), { sessionId: SESSION_ID }))).resolves.toMatchObject({ revokedCurrentSession: true });
	});

	it("answers not found for another user's session, and refuses during impersonation or without a user", async () => {
		store.sessions.seed(sessionState({ id: "foreign", userId: "user-2" }));

		await expect(handler().execute(new RevokeMySessionCommand(userActor(USER_ID), { sessionId: "foreign" }))).rejects.toBeInstanceOf(DeviceSessionNotFoundError);
		expect(store.sessions.revokerOf("foreign")).toBeNull();
		await expect(handler().execute(new RevokeMySessionCommand(userActor(USER_ID, { impersonatorUserId: ADMIN_ID }), { sessionId: SESSION_ID }))).rejects.toBeInstanceOf(
			SessionRevokeDuringImpersonationError,
		);
		await expect(handler().execute(new RevokeMySessionCommand(anonymousActor(), { sessionId: SESSION_ID }))).rejects.toBeInstanceOf(DeviceSessionNotFoundError);
	});
});

const noMemberships: ImpersonationTenantFacts = {
	membershipTenantIds: (): Promise<readonly string[]> => Promise.resolve([]),
	approvedGrants: (): Promise<readonly ApprovedSupportGrant[]> => Promise.resolve([]),
};

describe("Start and stop impersonation", () => {
	const ADMIN_SESSION_ID = "admin-session";
	const ADMIN_REFRESH = "admin-refresh-token";

	beforeEach(() => {
		store.accounts.seed(accountState({ id: ADMIN_ID, email: EmailAddress.of("admin@example.com"), isSuperAdmin: true, twoFactorEnabled: true }));
		store.sessions.seed(sessionState({ id: ADMIN_SESSION_ID, userId: ADMIN_ID }));
		tokens.refreshTokens.set(ADMIN_REFRESH, refreshClaims(ADMIN_ID, "admin@example.com", ADMIN_SESSION_ID));
	});

	function start(mfaAssuredAt: number | null = NOW): Promise<ImpersonateServiceResponse> {
		return new StartImpersonationHandler(store.uow, noMemberships, new FixedGrants(), tokens, new SequentialIds("imp"), TEST_SETTINGS, clock).execute(
			new StartImpersonationCommand(userActor(ADMIN_ID, { isSuperAdmin: true }), { targetUserId: USER_ID, mfaAssuredAt, ipAddress: null, userAgent: null }),
		);
	}

	function stop(presentedRefreshToken: string = ADMIN_REFRESH, impersonationSessionId = "imp-1"): Promise<StopImpersonationServiceResponse> {
		return new StopImpersonationHandler(store.uow, new FixedGrants(), tokens, clock).execute(
			new StopImpersonationCommand(userActor(USER_ID, { impersonatorUserId: ADMIN_ID }), {
				impersonatorId: ADMIN_ID,
				targetUserId: USER_ID,
				impersonationSessionId,
				presentedRefreshToken,
				ipAddress: null,
				userAgent: null,
			}),
		);
	}

	it("starts a session bound to the impersonation token, after a fresh step-up", async () => {
		await expect(start()).resolves.toMatchObject({ accessToken: `impersonation:${USER_ID}:${ADMIN_ID}:imp-1`, originalUserId: ADMIN_ID, impersonating: true });

		expect(store.impersonations.audits).toEqual(["START"]);
		expect(store.eventNames()).toEqual(["identity.ImpersonationStarted"]);
		await expect(start(epochMs(NOW - TEST_SETTINGS.mfaStepUpTtlMs - 1))).rejects.toBeInstanceOf(MfaStepUpRequiredError);
	});

	it("refuses to impersonate a tenant member when that tenant has no approved grant", async () => {
		const member: ImpersonationTenantFacts = {
			membershipTenantIds: (): Promise<readonly string[]> => Promise.resolve(["tenant-a"]),
			approvedGrants: (): Promise<readonly ApprovedSupportGrant[]> => Promise.resolve([{ grantId: "grant-b", tenantId: "tenant-b" }]),
		};

		await expect(
			new StartImpersonationHandler(store.uow, member, new FixedGrants(), tokens, new SequentialIds("imp"), TEST_SETTINGS, clock).execute(
				new StartImpersonationCommand(userActor(ADMIN_ID, { isSuperAdmin: true }), { targetUserId: USER_ID, mfaAssuredAt: NOW, ipAddress: null, userAgent: null }),
			),
		).rejects.toBeInstanceOf(ImpersonationGrantRequiredError);
	});

	it("PLAT-004: records the approved grant that authorized impersonating a tenant member on the session", async () => {
		const member: ImpersonationTenantFacts = {
			membershipTenantIds: (): Promise<readonly string[]> => Promise.resolve(["tenant-a"]),
			approvedGrants: (): Promise<readonly ApprovedSupportGrant[]> => Promise.resolve([{ grantId: "grant-a", tenantId: "tenant-a" }]),
		};

		await new StartImpersonationHandler(store.uow, member, new FixedGrants(), tokens, new SequentialIds("imp"), TEST_SETTINGS, clock).execute(
			new StartImpersonationCommand(userActor(ADMIN_ID, { isSuperAdmin: true }), { targetUserId: USER_ID, mfaAssuredAt: NOW, ipAddress: null, userAgent: null }),
		);

		expect(store.impersonations.rows.get("imp-1")?.supportAccessGrantIds).toEqual(["grant-a"]);
		expect(store.impersonations.audits).toEqual(["START"]);
	});

	it("refuses a second live session for the same administrator (D36)", async () => {
		await start();

		await expect(start()).rejects.toBeInstanceOf(ImpersonationAlreadyActiveError);
	});

	it("restores the administrator with a token bound to their own device session", async () => {
		await start();

		await expect(stop()).resolves.toMatchObject({ accessToken: `access:${ADMIN_ID}:${ADMIN_SESSION_ID}` });

		expect(store.impersonations.rows.get("imp-1")).toMatchObject({ endedBy: ADMIN_ID });
		expect(store.impersonations.audits).toEqual(["START", "STOP"]);
		await expect(stop()).rejects.toBeInstanceOf(ImpersonationSessionInvalidError);
	});

	it("refuses a refresh token of someone else, or of a revoked device session, ending nothing", async () => {
		await start();
		tokens.refreshTokens.set("user-refresh", refreshClaims(USER_ID, "jane@example.com", SESSION_ID));

		await expect(stop("user-refresh")).rejects.toBeInstanceOf(RefreshTokenInvalidError);
		const row = store.sessions.rows.get(ADMIN_SESSION_ID);
		if (row !== undefined) {
			store.sessions.rows.set(ADMIN_SESSION_ID, { ...row, isDeleted: true });
		}
		await expect(stop()).rejects.toBeInstanceOf(RefreshTokenRevokedError);
		expect(store.impersonations.rows.get("imp-1")?.endedAt).toBeNull();
		expect(tokens.accessTokensIssued).toEqual([]);
	});

	it("restores nothing when the administrator lost SuperAdmin meanwhile", async () => {
		await start();
		store.accounts.seed(accountState({ id: ADMIN_ID, email: EmailAddress.of("admin@example.com"), isSuperAdmin: false }));

		await expect(stop()).rejects.toBeInstanceOf(ImpersonatorNotEligibleError);
		expect(store.impersonations.rows.get("imp-1")?.endedAt).toBeNull();
	});
});
