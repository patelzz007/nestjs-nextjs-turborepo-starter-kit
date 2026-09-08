import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedConfigService } from "../../config/typed-config.service";
import type { LogService } from "../logs/logs.service";
import type { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import type { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import type { UserResponseMapper } from "../auth/services/user-response.mapper";
import type { CryptoService } from "../auth/services/crypto.service";
import type { AccessTokenStateService } from "../auth/services/access-token-state.service";
import type { TokenService } from "../auth/services/token.service";
import type { SessionRestrictionService } from "../auth/services/session-restriction.service";
import type { SessionsEventsService } from "./sessions-events.service";
import type { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import type { UserRepository } from "../auth/repositories/user.repository";

import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
	let service: SessionsService;
	let repository: {
		findByIdIncludingDeleted: ReturnType<typeof vi.fn>;
		rotateTokenIfHashMatches: ReturnType<typeof vi.fn>;
		revokeAllForUsers: ReturnType<typeof vi.fn>;
	};
	let users: { findLoginById: ReturnType<typeof vi.fn> };
	let tokenService: { generateSessionTokens: ReturnType<typeof vi.fn> };
	let cryptoService: { compare: ReturnType<typeof vi.fn>; hash: ReturnType<typeof vi.fn> };
	const userId = "user-1";
	const refreshTokenJti = "rt-jti-1";

	beforeEach(() => {
		repository = {
			findByIdIncludingDeleted: vi.fn(),
			rotateTokenIfHashMatches: vi.fn(),
			revokeAllForUsers: vi.fn(),
		};
		users = { findLoginById: vi.fn() };

		const tokenServiceMock = { generateSessionTokens: vi.fn().mockResolvedValue({ accessToken: "at", refreshToken: "rt" }) };
		const cryptoServiceMock = { compare: vi.fn(), hash: vi.fn().mockResolvedValue("hashed") };
		tokenService = tokenServiceMock;
		cryptoService = cryptoServiceMock;
		const config = { jwtRefreshExpiry: "7d" } as TypedConfigService;
		const logService = { warn: vi.fn() };
		const authorizationChecker = { getUserPermissionDetails: vi.fn().mockResolvedValue({ roles: [], permissions: [] }) };
		const mapper = { toFlatUser: vi.fn().mockReturnValue({ id: userId, tokenVersion: 1 }) };
		const sessionsEvents = { emitAction: vi.fn() };
		const accessTokenState = { bumpTokenVersion: vi.fn() };
		const sessionRevocation = { revokeAllSessionsForUser: vi.fn() };
		const sessionRestriction = {
			resolveSessionTokens: vi.fn().mockReturnValue({ sessionScope: "restricted", mfaAssuredAt: undefined }),
		};

		service = new SessionsService(
			repository as unknown as RefreshTokenRepository,
			users as unknown as UserRepository,
			tokenServiceMock as unknown as TokenService,
			cryptoServiceMock as unknown as CryptoService,
			config,
			logService as unknown as LogService,
			authorizationChecker as unknown as AuthorizationCheckerService,
			mapper as unknown as UserResponseMapper,
			sessionsEvents as unknown as SessionsEventsService,
			accessTokenState as unknown as AccessTokenStateService,
			sessionRevocation as unknown as UserSessionRevocationService,
			sessionRestriction as unknown as SessionRestrictionService,
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
		repository.rotateTokenIfHashMatches.mockResolvedValue("rotated");

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
});
