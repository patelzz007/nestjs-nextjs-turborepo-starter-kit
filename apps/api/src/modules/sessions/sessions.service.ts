import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { RefreshResponse, Session, UserResponse } from "@workspace/shared";
import { SessionSchema } from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../common/utils/expiry.js";
import { TypedConfigService } from "../../config/typed-config.service.js";
import { LogService } from "../../modules/logs/logs.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CryptoService } from "../auth/services/crypto.service.js";
import { TokenService } from "../auth/services/token.service.js";

/**
 * Owns the refresh-token / active-session lifecycle: token rotation,
 * device logout, logout-all, and the active-session list.
 *
 * Split out of the (previously monolithic) `AuthService` so credentials and
 * session management live in separate modules — see `docs/architecture.md`
 * (module layout convention).
 */
@Injectable()
export class SessionsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly tokenService: TokenService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly rbacService: RbacService,
		private readonly authService: AuthService,
	) {}

	public async refreshToken(userId: string, rawRefreshTokenJwt: string, refreshTokenJti: string, deviceInfo?: string, ipAddress?: string): Promise<RefreshResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				isActive: true,
				isSuperAdmin: true,
				fullName: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});

		if (!user) {
			throw new UnauthorizedException({
				message: "User account no longer exists. Please log in again.",
				error: "USER_NOT_FOUND",
			});
		}

		if (!user.isActive) {
			throw new UnauthorizedException({
				message: "Account is inactive. Please contact support.",
				error: "ACCOUNT_IS_INACTIVE",
			});
		}

		if (user.isDeleted) {
			throw new UnauthorizedException({
				message: "Account has been deleted. Please contact support.",
				error: "ACCOUNT_DELETED",
			});
		}

		// Look up the refresh token record directly by its ID (extracted from JWT jti claim)
		const storedToken = await this.prisma.refreshToken.findUnique({
			where: { id: refreshTokenJti },
		});

		if (storedToken?.userId !== userId) {
			throw new UnauthorizedException({
				message: "Invalid refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		if (storedToken.expiresAt < new Date()) {
			throw new UnauthorizedException("Refresh token has expired");
		}

		// ── Reuse Detection (Strategy 3) ────────────────────────────────────
		// Compare the incoming raw refresh token JWT against the stored bcrypt hash.
		// If they DON'T match, someone is using an OLD refresh token that was
		// already rotated — this indicates token theft.
		// ─────────────────────────────────────────────────────────────────────
		const tokenMatches = await this.cryptoService.compare(rawRefreshTokenJwt, storedToken.token);
		if (!tokenMatches) {
			this.logService.warn("Suspicious activity: token reuse detected — revoking all sessions", {
				userId: user.id,
				context: "SessionsService",
				metadata: { tokenId: storedToken.id },
			});

			// Token theft detected — revoke ALL refresh tokens for this user
			await this.prisma.refreshToken.updateMany({
				where: { userId: user.id },
				data: { isDeleted: true, deletedAt: new Date() },
			});

			throw new UnauthorizedException({
				message: "Suspicious activity detected. All sessions have been revoked. Please log in again.",
				error: "TOKEN_THEFT_DETECTED",
			});
		}

		// Get user permissions
		const userPermissions = await this.rbacService.getUserPermissions(user.id);
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= new Date();
		const flatUser: UserResponse = this.authService.buildUserResponse(user, userPermissions, isEmailVerified);

		// Update the existing refresh token record with new expiry and hashed token (rotation)
		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt = new Date(Date.now() + expiryMs);

		const tokens = await this.tokenService.generateTokens(flatUser, storedToken.id);
		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		await this.prisma.refreshToken.update({
			where: { id: storedToken.id },
			data: {
				token: hashedRt,
				deviceInfo: deviceInfo ?? storedToken.deviceInfo,
				ipAddress: ipAddress ?? storedToken.ipAddress,
				expiresAt,
			},
		});

		return tokens;
	}

	/**
	 * Logout from the specific device identified by the refresh token's jti.
	 */
	public async logoutDevice(userId: string, refreshTokenJti: string): Promise<void> {
		const storedToken = await this.prisma.refreshToken.findUnique({
			where: { id: refreshTokenJti },
		});

		if (storedToken?.userId === userId) {
			await this.prisma.refreshToken.update({
				where: { id: storedToken.id },
				data: { isDeleted: true, deletedAt: new Date() },
			});
		}
	}

	/**
	 * Logout from all devices — clears every refresh token for this user.
	 */
	public async logoutAllDevices(userId: string): Promise<void> {
		await this.prisma.refreshToken.updateMany({
			where: { userId },
			data: { isDeleted: true, deletedAt: new Date() },
		});
	}

	/**
	 * Get all active sessions (refresh tokens) for the current user.
	 * Returns device info, IP, creation date, and expiry date.
	 * Does NOT return the token hash.
	 */
	public async getSessions(userId: string): Promise<Session[]> {
		const tokens = await this.prisma.refreshToken.findMany({
			where: {
				userId,
				isDeleted: false,
				expiresAt: { gte: new Date() },
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				deviceInfo: true,
				ipAddress: true,
				createdAt: true,
				expiresAt: true,
			},
		});

		// Convert Date objects to ISO strings before Zod validation.
		// SessionSchema expects `expiresAt` and `createdAt` as `z.string()`, but
		// Prisma returns native Date objects. Without this conversion, Zod throws.
		return tokens.map((t: { id: string; deviceInfo: string | null; ipAddress: string | null; createdAt: Date; expiresAt: Date }) =>
			SessionSchema.parse({
				id: t.id,
				deviceInfo: t.deviceInfo,
				ipAddress: t.ipAddress,
				createdAt: t.createdAt.toISOString(),
				expiresAt: t.expiresAt.toISOString(),
			}),
		);
	}
}
