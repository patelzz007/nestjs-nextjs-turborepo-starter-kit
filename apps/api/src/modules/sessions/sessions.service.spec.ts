import { UnauthorizedException } from "@nestjs/common";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Test } from "@nestjs/testing";

import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../prisma/prisma.service";
import { LogService } from "../logs/logs.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { TokenService } from "../auth/services/token.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { UserRepository } from "../auth/repositories/user.repository";

import { SessionsService } from "./sessions.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

/** Identity of "the domain transaction" — the outbox write must receive exactly this client. */
const DOMAIN_TX = new PrismaService(createTestTypedConfig());

describe("SessionsService", () => {
	let service: SessionsService;
	const repository = {
		findByIdIncludingDeleted: vi.fn(),
		rotateTokenIfHashMatches: vi.fn<RefreshTokenRepository["rotateTokenIfHashMatches"]>(),
		revokeLiveToken: vi.fn<RefreshTokenRepository["revokeLiveToken"]>(),
	};
	const outbox = {
		enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
		recordTelemetry: vi.fn<PlatformOutboxService["recordTelemetry"]>(),
	};
	const sessionRevocation = { revokeAllSessionsForUser: vi.fn<UserSessionRevocationService["revokeAllSessionsForUser"]>() };
	const users = { findLoginById: vi.fn() };
	const tokenService = { generateSessionTokens: vi.fn() };
	const cryptoService = { compare: vi.fn(), hash: vi.fn() };
	const userId = "user-1";
	const refreshTokenJti = "rt-jti-1";

	beforeEach(async () => {
		vi.clearAllMocks();
		tokenService.generateSessionTokens.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });
		cryptoService.hash.mockResolvedValue("hashed");
		outbox.enqueueInTransaction.mockResolvedValue("evt-1");
		outbox.recordTelemetry.mockResolvedValue({ recorded: true, eventId: "evt-telemetry" });
		// Repositories run the caller's same-transaction write inside their transaction.
		repository.rotateTokenIfHashMatches.mockImplementation(async (_id, _hash, _data, onRotated): Promise<"rotated"> => {
			await onRotated(DOMAIN_TX);
			return "rotated";
		});
		repository.revokeLiveToken.mockImplementation(async (_id, _userId, withinTransaction): Promise<boolean> => {
			await withinTransaction(DOMAIN_TX);
			return true;
		});
		sessionRevocation.revokeAllSessionsForUser.mockImplementation(async (_userId, _trigger, withinTransaction): Promise<void> => {
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
			deviceInfo: "test",
			ipAddress: "127.0.0.1",
		});
		cryptoService.compare.mockResolvedValue(true);

		await service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti);

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

		await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti)).rejects.toMatchObject({
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
		readonly deviceInfo: string;
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
			deviceInfo: "test",
			ipAddress: "127.0.0.1",
		};
	}

	describe("platform events (transactional outbox)", () => {
		it("writes the refresh-succeeded event inside the rotation transaction", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.compare.mockResolvedValue(true);

			await service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti);

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
			cryptoService.compare.mockResolvedValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("superseded");

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_SUPERSEDED" } });

			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
			expect(outbox.recordTelemetry.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({
				payload: { action: "refresh", status: "failed", error: "REFRESH_TOKEN_SUPERSEDED" },
			});
		});

		it("keeps the 401 even when recording the rejection telemetry fails", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.compare.mockResolvedValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("superseded");
			outbox.recordTelemetry.mockResolvedValue({ recorded: false, error: "db down" });

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti)).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it("revokes every session and writes the theft event in ONE transaction on token reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.compare.mockResolvedValue(false);

			await expect(service.refreshToken(userId, "stolen-refresh-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(userId, "refresh_token_reuse", expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { status: "failed", error: "TOKEN_THEFT_DETECTED" } });
		});

		it("does not write the theft event when the revocation transaction fails (rolled back together)", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.compare.mockResolvedValue(false);
			sessionRevocation.revokeAllSessionsForUser.mockRejectedValue(new Error("serialization failure"));

			await expect(service.refreshToken(userId, "stolen-refresh-jwt", refreshTokenJti)).rejects.toThrow("serialization failure");

			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
		});

		it("writes the logout-device event inside the revocation transaction for the caller's own live token", async () => {
			await service.logoutDevice(userId, refreshTokenJti);

			expect(repository.revokeLiveToken).toHaveBeenCalledWith(refreshTokenJti, userId, expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { action: "logout-device", status: "succeeded" } });
			expect(outbox.recordTelemetry).not.toHaveBeenCalled();
		});

		it("records telemetry (no in-transaction event) when no live token of the caller was revoked", async () => {
			repository.revokeLiveToken.mockResolvedValue(false);

			await service.logoutDevice(userId, refreshTokenJti);

			expect(repository.revokeLiveToken).toHaveBeenCalledWith(refreshTokenJti, userId, expect.any(Function));
			expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
			expect(outbox.recordTelemetry.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ payload: { action: "logout-device" } });
		});

		it("writes the logout-all event inside the revoke-all transaction", async () => {
			await service.logoutAllDevices(userId);

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(userId, "logout_all_devices", expect.any(Function));
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(DOMAIN_TX);
			expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { action: "logout-all", status: "succeeded" } });
		});
	});

	describe("refresh-token reuse grace window", () => {
		const recentlyRotated: number = Date.now() - 1_000;

		it("accepts ONLY the immediate predecessor inside the grace window as superseded (no revocation)", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: "previous-hash" }));
			cryptoService.compare.mockImplementation((_raw: string, hash: string): Promise<boolean> => Promise.resolve(hash === "previous-hash"));

			await expect(service.refreshToken(userId, "predecessor-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "REFRESH_TOKEN_SUPERSEDED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).not.toHaveBeenCalled();
		});

		it("treats an older token of the same session presented inside the grace window as reuse and revokes every session", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: "previous-hash" }));
			cryptoService.compare.mockResolvedValue(false);

			await expect(service.refreshToken(userId, "two-rotations-old-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(userId, "refresh_token_reuse", expect.any(Function));
		});

		it("treats a non-current token inside the grace window as reuse when there is no recorded predecessor", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ updatedAt: recentlyRotated, previousTokenHash: null }));
			cryptoService.compare.mockResolvedValue(false);

			await expect(service.refreshToken(userId, "foreign-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
		});

		it("treats the immediate predecessor presented AFTER the grace window as reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow({ previousTokenHash: "previous-hash" }));
			cryptoService.compare.mockImplementation((_raw: string, hash: string): Promise<boolean> => Promise.resolve(hash === "previous-hash"));

			await expect(service.refreshToken(userId, "predecessor-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
		});

		it("revokes every session when the conditional rotation reports reuse", async () => {
			users.findLoginById.mockResolvedValue(activeUser);
			repository.findByIdIncludingDeleted.mockResolvedValue(storedTokenRow());
			cryptoService.compare.mockResolvedValue(true);
			repository.rotateTokenIfHashMatches.mockResolvedValue("reused");

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti)).rejects.toMatchObject({ response: { error: "TOKEN_THEFT_DETECTED" } });

			expect(sessionRevocation.revokeAllSessionsForUser).toHaveBeenCalledWith(userId, "refresh_token_reuse", expect.any(Function));
		});
	});
});
