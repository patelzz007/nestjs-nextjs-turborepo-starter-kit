import { UnauthorizedException } from "@nestjs/common";
import { epochMs, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Test } from "@nestjs/testing";

import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../prisma/prisma.service";
import { LogService } from "../logs/logs.service";
import { AuthorizationInvalidationService } from "../authorization/cache/authorization-invalidation.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { TokenService } from "../auth/services/token.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import type { SessionDeviceContext } from "./device/session-device";
import { RefreshTokenRepository, type DeviceSessionRecord, type SessionRevocationOutcome } from "./repositories/refresh-token.repository";
import { UserRepository } from "../auth/repositories/user.repository";

import { SessionsService } from "./sessions.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

/** Logout / revoke outcomes in which this call revoked nothing. */
const NOTHING_REVOKED: [SessionRevocationOutcome, SessionRevocationOutcome] = ["already_revoked", "not_found"];

/** Epoch ms of the fixture sessions' sign-in. */
const SIGNED_IN_AT_MS = 1_790_000_000_000;
const MINUTE_MS = 60_000;

/** Identity of "the domain transaction" — the outbox write must receive exactly this client. */
const DOMAIN_TX = new PrismaService(createTestTypedConfig());

describe("SessionsService", () => {
	let service: SessionsService;
	const repository = {
		findByIdIncludingDeleted: vi.fn(),
		rotateTokenIfHashMatches: vi.fn<RefreshTokenRepository["rotateTokenIfHashMatches"]>(),
		revokeOwnSession: vi.fn<RefreshTokenRepository["revokeOwnSession"]>(),
		listActiveSessionsForUser: vi.fn<RefreshTokenRepository["listActiveSessionsForUser"]>(),
	};
	const invalidation = { invalidateUsers: vi.fn<AuthorizationInvalidationService["invalidateUsers"]>() };
	const outbox = {
		enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
		recordTelemetry: vi.fn<PlatformOutboxService["recordTelemetry"]>(),
	};
	const sessionRevocation = { revokeAllSessionsForUser: vi.fn<UserSessionRevocationService["revokeAllSessionsForUser"]>() };
	const users = { findLoginById: vi.fn() };
	const tokenService = { generateSessionTokens: vi.fn() };
	const cryptoService = {
		matchesRefreshToken: vi.fn<(refreshToken: string, storedDigest: string) => boolean>(),
		hashRefreshToken: vi.fn<(refreshToken: string) => string>(),
		isRefreshTokenDigest: vi.fn<(storedHash: string) => boolean>(),
	};
	const userId = "user-1";
	const refreshTokenJti = "rt-jti-1";
	/** The refreshing request: a mobile phone on a new network. */
	const REFRESHING: SessionDeviceContext = {
		device: {
			clientType: "mobile",
			browserName: "CFNetwork",
			browserVersion: null,
			osName: "iOS",
			osVersion: null,
			deviceType: "MOBILE",
			deviceModel: "iPhone 15 Pro",
			deviceName: "Alex’s iPhone",
			appVersion: "1.4.0",
		},
		ipAddress: "198.51.100.7",
		userAgent: "Expo/1 CFNetwork/1568 Darwin/24.0.0",
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		tokenService.generateSessionTokens.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });
		cryptoService.hashRefreshToken.mockReturnValue("hashed");
		cryptoService.isRefreshTokenDigest.mockReturnValue(true);
		outbox.enqueueInTransaction.mockResolvedValue("evt-1");
		outbox.recordTelemetry.mockResolvedValue({ recorded: true, eventId: "evt-telemetry" });
		// Repositories run the caller's same-transaction write inside their transaction.
		repository.rotateTokenIfHashMatches.mockImplementation(async (_id, _hash, _data, onRotated): Promise<"rotated"> => {
			await onRotated(DOMAIN_TX);
			return "rotated";
		});
		repository.revokeOwnSession.mockImplementation(async (_id, _userId, _revoker, withinTransaction): Promise<"revoked"> => {
			await withinTransaction(DOMAIN_TX);
			return "revoked";
		});
		invalidation.invalidateUsers.mockResolvedValue(undefined);
		sessionRevocation.revokeAllSessionsForUser.mockImplementation(async (_userId, _revoker, _trigger, withinTransaction): Promise<void> => {
			await withinTransaction?.(DOMAIN_TX);
		});

		// Typed stand-ins resolved from a Nest testing container — the real
		// collaborators pull in Prisma, JWT and the email stack.
		const moduleRef = await Test.createTestingModule({
			providers: [
				{ provide: RefreshTokenRepository, useValue: repository },
				{ provide: UserRepository, useValue: users },
				{ provide: TokenService, useValue: tokenService },
				{ provide: CryptoService, useValue: cryptoService },
				{ provide: TypedConfigService, useValue: { auth: { jwtRefreshExpiry: "7d" } } },
				{ provide: LogService, useValue: { warn: vi.fn() } },
				{ provide: AuthorizationCheckerService, useValue: { getUserPermissionDetails: vi.fn().mockResolvedValue({ roles: [], permissions: [] }) } },
				{ provide: UserResponseMapper, useValue: { toFlatUser: vi.fn().mockReturnValue({ id: userId, tokenVersion: 1 }) } },
				{ provide: PlatformOutboxService, useValue: outbox },
				{ provide: UserSessionRevocationService, useValue: sessionRevocation },
				{ provide: AuthorizationInvalidationService, useValue: invalidation },
				{
					provide: SessionRestrictionService,
					useValue: { resolveSessionTokens: vi.fn().mockReturnValue({ sessionScope: "restricted", mfaAssuredAt: undefined }) },
				},
			],
		}).compile();

		service = new SessionsService(
			moduleRef.get(RefreshTokenRepository),
			moduleRef.get(UserRepository),
			moduleRef.get(TokenService),
			moduleRef.get(CryptoService),
			moduleRef.get(TypedConfigService),
			moduleRef.get(LogService),
			moduleRef.get(AuthorizationCheckerService),
			moduleRef.get(UserResponseMapper),
			moduleRef.get(PlatformOutboxService),
			moduleRef.get(UserSessionRevocationService),
			moduleRef.get(SessionRestrictionService),
			moduleRef.get(AuthorizationInvalidationService),
		);
	});

	it("preserves restricted scope during refresh", async () => {
		users.findLoginById.mockResolvedValue({
			id: userId,
			email: "user@example.com",
			isActive: true,
			isSuperAdmin: false,
			fullName: "Test User",
			emailVerifiedAt: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isDeleted: false,
			deletedAt: null,
			twoFactorEnabled: false,
			mfaEnrollmentDeadline: Date.now() + 60_000,
			mfaAssuredAt: null,
		});
		repository.findByIdIncludingDeleted.mockResolvedValue({
			id: refreshTokenJti,
			userId,
			token: "hashed-token",
			previousTokenHash: null,
			updatedAt: Date.now(),
			expiresAt: Date.now() + 60_000,
			isDeleted: false,
			ipAddress: "127.0.0.1",
		});
		cryptoService.matchesRefreshToken.mockReturnValue(true);

		await service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING);

		expect(tokenService.generateSessionTokens).toHaveBeenCalledWith(
			expect.objectContaining({ id: userId }),
			refreshTokenJti,
			expect.objectContaining({ sessionScope: "restricted" }),
		);
	});

	it("rejects a revoked refresh token when isDeleted is true", async () => {
		users.findLoginById.mockResolvedValue({
			id: userId,
			email: "user@example.com",
			isActive: true,
			isSuperAdmin: false,
			fullName: "Test User",
			emailVerifiedAt: Date.now(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isDeleted: false,
			deletedAt: null,
		});
		repository.findByIdIncludingDeleted.mockResolvedValue({
			id: refreshTokenJti,
			userId,
			token: "hashed-token",
			expiresAt: Date.now() + 60_000,
			isDeleted: true,
		});

		await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({
			response: {
				error: "REFRESH_TOKEN_REVOKED",
			},
		});
	});

	const activeUser = {
		id: userId,
		email: "user@example.com",
		isActive: true,
		isSuperAdmin: false,
		fullName: "Test User",
		emailVerifiedAt: Date.now(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
		isDeleted: false,
		deletedAt: null,
	};

	interface StoredRefreshTokenFixture {
		readonly id: string;
		readonly userId: string;
		readonly token: string;
		readonly previousTokenHash: string | null;
		readonly updatedAt: number;
		readonly expiresAt: number;
		readonly isDeleted: boolean;
		readonly ipAddress: string;
	}

	function storedTokenRow(overrides: { readonly updatedAt?: number; readonly previousTokenHash?: string | null } = {}): StoredRefreshTokenFixture {
		return {
			id: refreshTokenJti,
			userId,
			token: "hashed-token",
			previousTokenHash: overrides.previousTokenHash ?? null,
			updatedAt: overrides.updatedAt ?? Date.now() - 60 * 60_000,
			expiresAt: Date.now() + 60_000,
			isDeleted: false,
			ipAddress: "127.0.0.1",
		};
	}

	describe("platform events (transactional outbox)", () => {
		it("writes the refresh-succeeded event inside the rotation transaction", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(true);

			await service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING);

			expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({
				type: "session.action",
				payload: { action: "refresh", userId, status: "succeeded", error: null },
			});
			expect(outbox.recordTelemetry).not.toHaveBeenCalled();
		});

		it("records a superseded rotation as telemetry (no domain write) and still rejects with 401", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("superseded");

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_SUPERSEDED" } });

			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
			expect(outbox.recordTelemetry.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({
				payload: { action: "refresh", status: "failed", error: "REFRESH_TOKEN_SUPERSEDED" },
			});
		});

		it("keeps the 401 even when recording the rejection telemetry fails", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("superseded");
			outbox.recordTelemetry.mockResolvedValue({ recorded: false, error: "db down" });

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it("revokes every session and writes the theft event in ONE transaction on token reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(false);

			await expect(service.refreshToken(userId, "stolen-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(
				userId,
				{ kind: "system", marker: "system:rotation-reuse" },
				"refresh_token_reuse",
				expect.any(Function),
			);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { status: "failed", error: "TOKEN_THEFT_DETECTED" } });
		});

		it("does not write the theft event when the revocation transaction fails (rolled back together)", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(false);
			sessionRevocation.revokeAllSessionsForUser.mockRejectedValue(new Error("serialization failure"));

			await expect(service.refreshToken(userId, "stolen-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toThrow("serialization failure");

			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
		});

		it("writes the logout-device event inside the revocation transaction for the caller's own live token", async () => {
			await service.logoutDevice(userId, refreshTokenJti);

			expect(repository.revokeOwnSession).toHaveBeenCalledWith(refreshTokenJti, userId, { kind: "user", userId }, expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { action: "logout-device", status: "succeeded" } });
			expect(outbox.recordTelemetry).not.toHaveBeenCalled();
		});

		it("drops the cached access-token state after the logout committed, so the session's sid is rejected at once", async () => {
			await service.logoutDevice(userId, refreshTokenJti);

			expect(invalidation.invalidateUsers).toHaveBeenCalledWith([userId], { accessTokenState: true, trigger: "session_revoked" });
		});

		it.each(NOTHING_REVOKED)("records telemetry (no in-transaction event, no invalidation) when the logout revoked nothing (%s)", async (outcome) => {
			repository.revokeOwnSession.mockResolvedValue(outcome);

			await service.logoutDevice(userId, refreshTokenJti);

			expect(repository.revokeOwnSession).toHaveBeenCalledWith(refreshTokenJti, userId, { kind: "user", userId }, expect.any(Function));
			expect(invalidation.invalidateUsers).not.toHaveBeenCalled();
			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
			expect(outbox.recordTelemetry.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ payload: { action: "logout-device" } });
		});

		it("writes the logout-all event inside the revoke-all transaction", async () => {
			await service.logoutAllDevices(userId);

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(userId, { kind: "user", userId }, "logout_all_devices", expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { action: "logout-all", status: "succeeded" } });
		});
	});

	describe("refresh-token reuse grace window", () => {
		const recentlyRotated: number = Date.now() - 1_000;

		it("accepts ONLY the immediate predecessor inside the grace window as superseded (no revocation)", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: "previous-hash" }));
			cryptoService.matchesRefreshToken.mockImplementation((_raw: string, hash: string): boolean => hash === "previous-hash");

			await expect(service.refreshToken(userId, "predecessor-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_SUPERSEDED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).not.toHaveBeenCalled();
		});

		it("treats an older token of the same session presented inside the grace window as reuse and revokes every session", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: "previous-hash" }));
			cryptoService.matchesRefreshToken.mockReturnValue(false);

			await expect(service.refreshToken(userId, "two-rotations-old-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(
				userId,
				{ kind: "system", marker: "system:rotation-reuse" },
				"refresh_token_reuse",
				expect.any(Function),
			);
		});

		it("treats a non-current token inside the grace window as reuse when there is no recorded predecessor", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: null }));
			cryptoService.matchesRefreshToken.mockReturnValue(false);

			await expect(service.refreshToken(userId, "foreign-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
		});

		it("treats the immediate predecessor presented AFTER the grace window as reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ previousTokenHash: "previous-hash" }));
			cryptoService.matchesRefreshToken.mockImplementation((_raw: string, hash: string): boolean => hash === "previous-hash");

			await expect(service.refreshToken(userId, "predecessor-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
		});

		it("asks a session stored before refresh-token digests (a bcrypt hash) to sign in again — 401, never a theft revocation", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.isRefreshTokenDigest.mockReturnValue(false);

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_INVALID" } });

			expect(cryptoService.matchesRefreshToken).not.toHaveBeenCalled();
			expect(sessionRevocation.revokeAllSessionsForUser).not.toHaveBeenCalled();
			expect(repository.rotateTokenIfHashMatches).not.toHaveBeenCalled();
		});

		it("revokes every session when the conditional rotation reports reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("reused");

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(
				userId,
				{ kind: "system", marker: "system:rotation-reuse" },
				"refresh_token_reuse",
				expect.any(Function),
			);
		});
	});

	describe("refresh activity", () => {
		it("rotates in place and records the refreshing request's IP as lastIpAddress (device details carry forward)", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.matchesRefreshToken.mockReturnValue(true);

			await service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti, REFRESHING);

			const [rotatedId, expectedHash, rotation] = repository.rotateTokenIfHashMatches.mock.lastCall ?? [];
			expect([rotatedId, expectedHash]).toEqual([refreshTokenJti, "hashed-token"]);
			expect(rotation).toMatchObject({ token: "hashed", lastIpAddress: "198.51.100.7" });
			expect(tokenService.generateSessionTokens).toHaveBeenCalledWith(expect.anything(), refreshTokenJti, expect.anything());
		});
	});

	describe("revokeSession (one device from the list — ADR 034)", () => {
		const otherSessionId = "8f6f2d55-1c0f-4c3e-9b8e-6a1f2b3c4d5e";

		it("revokes the caller's own session with deletedBy = the caller, writes the revoke-device event in the same transaction, then rejects its sid everywhere", async () => {
			await expect(service.revokeSession(userId, otherSessionId, refreshTokenJti)).resolves.toEqual({ revokedCurrentSession: false });

			expect(repository.revokeOwnSession).toHaveBeenCalledWith(otherSessionId, userId, { kind: "user", userId }, expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { action: "revoke-device", userId, status: "succeeded" } });
			expect(invalidation.invalidateUsers).toHaveBeenCalledWith([userId], { accessTokenState: true, trigger: "session_revoked" });
		});

		it("reports that the caller's current session was revoked (a sign-out)", async () => {
			await expect(service.revokeSession(userId, refreshTokenJti, refreshTokenJti)).resolves.toEqual({ revokedCurrentSession: true });
		});

		it("is idempotent: an already revoked session answers success with no second event and no invalidation", async () => {
			repository.revokeOwnSession.mockResolvedValue("already_revoked");

			await expect(service.revokeSession(userId, otherSessionId, refreshTokenJti)).resolves.toEqual({ revokedCurrentSession: false });

			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
			expect(invalidation.invalidateUsers).not.toHaveBeenCalled();
		});

		it("answers 404 SESSION_NOT_FOUND for a session that is not the caller's (never 403)", async () => {
			repository.revokeOwnSession.mockResolvedValue("not_found");

			await expect(service.revokeSession(userId, otherSessionId, refreshTokenJti)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND", httpStatus: 404 });

			expect(invalidation.invalidateUsers).not.toHaveBeenCalled();
		});
	});

	describe("getSessions (the device list)", () => {
		function record(id: string, lastActiveMinutesAgo: number, overrides: Partial<DeviceSessionRecord> = {}): DeviceSessionRecord {
			return {
				id,
				clientType: "web",
				browserName: "Chrome",
				browserVersion: "141.0.7390.54",
				osName: "macOS",
				osVersion: "16.1",
				deviceType: "DESKTOP",
				deviceModel: null,
				deviceName: null,
				appVersion: null,
				signInMethod: "PASSWORD_TOTP",
				ipAddress: "203.0.113.24",
				lastIpAddress: "198.51.100.7",
				location: null,
				createdAt: epochMs(SIGNED_IN_AT_MS),
				lastActiveAt: epochMs(SIGNED_IN_AT_MS + MINUTE_MS * (100 - lastActiveMinutesAgo)),
				expiresAt: epochMs(SIGNED_IN_AT_MS + MINUTE_MS * 1_000),
				...overrides,
			};
		}

		it("puts the current session first, then the others by last activity (newest first), with isCurrent and a server-built label", async () => {
			repository.listActiveSessionsForUser.mockResolvedValue([
				record("stale", 90),
				record("current", 50),
				record("phone", 5, { clientType: "mobile", deviceModel: "iPhone 15 Pro", deviceName: "Alex’s iPhone", appVersion: "1.4.0" }),
			]);

			const sessions = await service.getSessions(userId, "current");

			expect(sessions.map((session) => [session.id, session.isCurrent, session.label])).toEqual([
				["current", true, "Chrome 141 on macOS"],
				["phone", false, "Alex’s iPhone"],
				["stale", false, "Chrome 141 on macOS"],
			]);
			expect(repository.listActiveSessionsForUser).toHaveBeenCalledWith(userId);
		});

		it("returns every stored detail of a session", async () => {
			const phone = record("phone", 5, {
				clientType: "mobile",
				deviceModel: "iPhone 15 Pro",
				deviceName: "Alex’s iPhone",
				appVersion: "1.4.0",
				location: { country: "MY", region: null, city: "Petaling Jaya" },
			});
			repository.listActiveSessionsForUser.mockResolvedValue([phone]);

			await expect(service.getSessions(userId, undefined)).resolves.toEqual([{ ...phone, label: "Alex’s iPhone", isCurrent: false }]);
		});

		it("marks no session current for a token without sid", async () => {
			repository.listActiveSessionsForUser.mockResolvedValue([record("one", 1), record("two", 2)]);

			const sessions = await service.getSessions(userId, undefined);

			expect(sessions.map((session) => session.isCurrent)).toEqual([false, false]);
		});
	});
});
