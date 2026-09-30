import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Test } from "@nestjs/testing";

import { TypedConfigService } from "../../config/typed-config.service";
import { LogService } from "../logs/logs.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { AccessTokenStateService } from "../auth/services/access-token-state.service";
import { TokenService } from "../auth/services/token.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import { SessionsEventsService } from "./sessions-events.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { UserRepository } from "../auth/repositories/user.repository";

import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
	let service: SessionsService;
	const repository = {
		findByIdIncludingDeleted: vi.fn(),
		rotateTokenIfHashMatches: vi.fn(),
		revokeAllForUsers: vi.fn(),
	};
	const users = { findLoginById: vi.fn() };
	const tokenService = { generateSessionTokens: vi.fn() };
	const cryptoService = { compare: vi.fn(), hash: vi.fn() };
	const userId = "user-1";
	const refreshTokenJti = "rt-jti-1";

	beforeEach(async () => {
		vi.clearAllMocks();
		tokenService.generateSessionTokens.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });
		cryptoService.hash.mockResolvedValue("hashed");

		// Typed stand-ins resolved from a Nest testing container — the real
		// collaborators pull in Prisma, JWT and the email stack.
		const moduleRef = await Test.createTestingModule({
			providers: [
				{ provide: RefreshTokenRepository, useValue: repository },
				{ provide: UserRepository, useValue: users },
				{ provide: TokenService, useValue: tokenService },
				{ provide: CryptoService, useValue: cryptoService },
				{ provide: TypedConfigService, useValue: { jwtRefreshExpiry: "7d" } },
				{ provide: LogService, useValue: { warn: vi.fn() } },
				{ provide: AuthorizationCheckerService, useValue: { getUserPermissionDetails: vi.fn().mockResolvedValue({ roles: [], permissions: [] }) } },
				{ provide: UserResponseMapper, useValue: { toFlatUser: vi.fn().mockReturnValue({ id: userId, tokenVersion: 1 }) } },
				{ provide: SessionsEventsService, useValue: { emitAction: vi.fn() } },
				{ provide: AccessTokenStateService, useValue: { bumpTokenVersion: vi.fn() } },
				{ provide: UserSessionRevocationService, useValue: { revokeAllSessionsForUser: vi.fn() } },
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
			moduleRef.get(SessionsEventsService),
			moduleRef.get(AccessTokenStateService),
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
