import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { TypedConfigService } from "../../config/typed-config.service";
import type { LogService } from "../logs/logs.service";
import type { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import type { UserResponseMapper } from "../auth/services/user-response.mapper";
import type { CryptoService } from "../auth/services/crypto.service";
import type { AccessTokenStateService } from "../auth/services/access-token-state.service";
import type { TokenService } from "../auth/services/token.service";
import type { SessionsEventsService } from "./sessions-events.service";

import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
	let service: SessionsService;
	let prisma: {
		user: { findUnique: ReturnType<typeof vi.fn> };
		refreshToken: { findUnique: ReturnType<typeof vi.fn> };
	};

	const userId = "user-1";
	const refreshTokenJti = "rt-jti-1";

	beforeEach(() => {
		prisma = {
			user: { findUnique: vi.fn() },
			refreshToken: { findUnique: vi.fn() },
		};

		const tokenService = { generateTokens: vi.fn() };
		const cryptoService = { compare: vi.fn(), hash: vi.fn() };
		const config = { jwtRefreshExpiry: "7d" } as TypedConfigService;
		const logService = { warn: vi.fn() };
		const authorizationChecker = { getUserPermissionDetails: vi.fn() };
		const mapper = { toFlatUser: vi.fn() };
		const sessionsEvents = { emitAction: vi.fn() };
		const accessTokenState = { bumpTokenVersion: vi.fn() };

		service = new SessionsService(
			prisma as unknown as PrismaService,
			tokenService as unknown as TokenService,
			cryptoService as unknown as CryptoService,
			config,
			logService as unknown as LogService,
			authorizationChecker as unknown as AuthorizationCheckerService,
			mapper as unknown as UserResponseMapper,
			sessionsEvents as unknown as SessionsEventsService,
			accessTokenState as unknown as AccessTokenStateService,
		);
	});

	describe("refreshToken", () => {
		it("rejects a revoked refresh token when isDeleted is true", async () => {
			prisma.user.findUnique.mockResolvedValue({
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
			prisma.refreshToken.findUnique.mockResolvedValue({
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

		it("wraps revoked refresh rejection in UnauthorizedException", async () => {
			prisma.user.findUnique.mockResolvedValue({
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
			prisma.refreshToken.findUnique.mockResolvedValue({
				id: refreshTokenJti,
				userId,
				token: "hashed-token",
				expiresAt: Date.now() + 60_000,
				isDeleted: true,
			});

			await expect(service.refreshToken(userId, "raw-refresh-jwt", refreshTokenJti)).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});
});
