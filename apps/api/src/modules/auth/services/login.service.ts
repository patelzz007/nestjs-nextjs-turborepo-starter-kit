import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { epochMs, type EpochMs, type LoginInput, type LoginServiceResponse, type UserPermissions } from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../../common/utils/expiry";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AccountLockoutService } from "./account-lockout.service";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { IdentityService } from "./identity.service";
import { TokenService } from "./token.service";
import { UserResponseMapper } from "./user-response.mapper";

/**
 * Handles the login flow: credential verification, admin access check,
 * brute-force protection (via `AccountLockoutService`), session creation,
 * and token generation.
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class LoginService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly tokenService: TokenService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly authEvents: AuthEventsService,
		private readonly logService: LogService,
		private readonly lockoutService: AccountLockoutService,
		private readonly mapper: UserResponseMapper,
		private readonly identityService: IdentityService,
	) {}

	@TrackAuthFlow({
		flow: "login",
		clientType: (_loginDto: unknown, clientType?: unknown) => (typeof clientType === "string" ? clientType : null),
	})
	public async login(loginDto: LoginInput, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<LoginServiceResponse> {
		const { email, password } = loginDto;

		const user = await this.userRepo.findLoginByEmail(email);

		// ── Client-type check: admin-only login ─────────────────────────
		if (clientType === "admin") {
			if (!user) {
				throw new ForbiddenException({
					message: "Admin access required. This account does not have administrator privileges.",
					error: "ADMIN_ACCESS_REQUIRED",
				});
			}

			if (!user.isSuperAdmin) {
				const userPerms: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(user.id);
				const hasDashboardAccess: boolean = userPerms.permissions.some((p) => p.resource === "ADMIN_DASHBOARD");

				if (!hasDashboardAccess) {
					throw new ForbiddenException({
						message: "Admin access required. This account does not have administrator privileges.",
						error: "ADMIN_ACCESS_REQUIRED",
					});
				}
			}
		}
		// ─────────────────────────────────────────────────────────────────

		// Use consistent dummy hash to prevent timing-based account enumeration
		const dummyHash = await this.cryptoService.hash("dummy-password-to-prevent-timing-attack");
		const passwordHash = user?.passwordHash ?? dummyHash;
		const passwordMatches = await this.cryptoService.compare(password, passwordHash);

		// ── Brute-force protection ────────────────────────────────────────
		// checkLockout throws UnauthorizedException if account is locked
		await this.lockoutService.checkLockout(user, clientType, performance.now());

		if (!user || !user.isActive || user.isDeleted || !passwordMatches) {
			if (user) {
				// recordFailedAttempt increments counter and throws if threshold crossed
				await this.lockoutService.recordFailedAttempt(user, clientType, performance.now());
			}

			// Non-existent / inactive user — throw directly
			throw new UnauthorizedException({
				message: "Invalid email or password",
				error: "INVALID_CREDENTIALS",
			});
		}
		// ─────────────────────────────────────────────────────────────────

		// ── Reset failed attempts on successful login ────────────────────
		await this.lockoutService.resetAttempts(user.id);

		// Get user permissions + build response
		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(user.id);
		if (clientType === "merchant") {
			const membership = await this.prisma.merchantMember.findFirst({
				where: { userId: user.id, isDeleted: false },
				select: { id: true },
			});
			const canManageMerchants: boolean = userPermissions.permissions.some((permission) => permission.action === "MANAGE" && permission.resource === "MERCHANT_ORG");

			if (membership === null && !canManageMerchants) {
				throw new ForbiddenException({
					message: "Merchant access required. This account is not linked to a merchant organization.",
					error: "MERCHANT_ACCESS_REQUIRED",
				});
			}
		}
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const profile = this.mapper.build(user, userPermissions, isEmailVerified);
		const flatUser = this.mapper.toFlatUser(user, userPermissions, isEmailVerified);

		// Create the refresh token record FIRST to get its ID (used as JWT jti)
		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(Date.now() + expiryMs);

		const refreshTokenRecord = await this.prisma.refreshToken.create({
			data: {
				token: "",
				userId: user.id,
				deviceInfo: deviceInfo ?? "Unknown Device",
				ipAddress: ipAddress ?? "Unknown IP",
				expiresAt,
			},
		});

		const tokens = await this.tokenService.generateTokens(flatUser, refreshTokenRecord.id);

		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		await this.prisma.refreshToken.update({
			where: { id: refreshTokenRecord.id },
			data: { token: hashedRt, updatedAt: Date.now() },
		});

		// Clean up expired tokens for this user
		await this.cleanupExpiredTokens(user.id);

		this.logService.info(`User logged in`, {
			userId: user.id,
			context: "LoginService",
			metadata: {
				email: user.email,
				fullName: user.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: user.isSuperAdmin,
				isEmailVerified,
				device: deviceInfo ?? "Unknown",
				ip: ipAddress ?? "Unknown",
				clientType: clientType ?? "web",
			},
		});

		await this.identityService.warmSessionCache(user.id, profile);

		return {
			user: profile,
			...tokens,
		};
	}

	private async cleanupExpiredTokens(userId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.refreshToken.updateMany({
				where: { userId, expiresAt: { lt: Date.now() } },
				data: { isDeleted: true, deletedAt: Date.now() },
			});

			const excessTokens = await tx.refreshToken.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				skip: 5,
			});

			if (excessTokens.length > 0) {
				await tx.refreshToken.updateMany({
					where: { id: { in: excessTokens.map((t) => t.id) } },
					data: { isDeleted: true, deletedAt: Date.now() },
				});
			}
		});
	}
}
