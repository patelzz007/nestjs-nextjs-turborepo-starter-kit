import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { epochMs, type EpochMs, type LoginRestrictedEnrollmentResponse, type LoginServiceResponse, type UserPermissions } from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../../common/utils/expiry";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { UserRepository } from "../repositories/user.repository";
import { IdentityService } from "./identity.service";
import { SessionRestrictionService } from "./session-restriction.service";
import { TokenService, type SessionScope, type SessionTokenGenerationOptions } from "./token.service";
import { CryptoService } from "./crypto.service";
import { UserResponseMapper } from "./user-response.mapper";

export interface IssueSessionOptions {
	readonly mfaAssured?: boolean;
}

/**
 * Issues authenticated sessions (refresh token + JWT pair).
 *
 * Extracted from `LoginService` so `TwoFactorService` can complete logins
 * without creating a circular module dependency at bundle time.
 */
@Injectable()
export class AuthSessionService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly tokenService: TokenService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
		private readonly identityService: IdentityService,
		private readonly sessionRestriction: SessionRestrictionService,
	) {}

	public async issueSessionForUser(
		userId: string,
		clientType?: string,
		deviceInfo?: string,
		ipAddress?: string,
		options: IssueSessionOptions = {},
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
		const user = await this.userRepo.findLoginById(userId);

		if (user === null || !user.isActive || user.isDeleted) {
			throw new UnauthorizedException({
				message: "Invalid email or password",
				error: "INVALID_CREDENTIALS",
			});
		}

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

		const now: number = Date.now();
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= now;
		const profile = this.mapper.build(user, userPermissions, isEmailVerified);
		const flatUser = this.mapper.toFlatUser(user, userPermissions, isEmailVerified);
		const restriction = this.sessionRestriction.resolveSessionRestriction(user, isEmailVerified, now);

		let mfaAssuredAt: number | undefined;
		if (options.mfaAssured === true) {
			mfaAssuredAt = now;
			await this.prisma.user.update({
				where: { id: user.id },
				data: { mfaAssuredAt, updatedAt: now },
			});
		} else {
			const resolved = this.sessionRestriction.resolveSessionTokens(user, now);
			mfaAssuredAt = resolved.mfaAssuredAt;
		}

		const sessionScope: SessionScope = restriction.restricted ? "restricted" : "full";
		const tokenOptions: SessionTokenGenerationOptions = {
			sessionScope,
			mfaAssuredAt,
		};

		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(now + expiryMs);

		const refreshTokenRecord = await this.prisma.refreshToken.create({
			data: {
				token: "",
				userId: user.id,
				deviceInfo: deviceInfo ?? "Unknown Device",
				ipAddress: ipAddress ?? "Unknown IP",
				expiresAt,
			},
		});

		const tokens = await this.tokenService.generateSessionTokens(flatUser, refreshTokenRecord.id, tokenOptions);

		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		await this.prisma.refreshToken.update({
			where: { id: refreshTokenRecord.id },
			data: { token: hashedRt, updatedAt: now },
		});

		await this.cleanupExpiredTokens(user.id);

		this.logService.info(`User logged in`, {
			userId: user.id,
			context: "AuthSessionService",
			metadata: {
				email: user.email,
				fullName: user.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: user.isSuperAdmin,
				isEmailVerified,
				sessionScope,
				enrollmentReason: restriction.restricted ? restriction.reason : null,
				device: deviceInfo ?? "Unknown",
				ip: ipAddress ?? "Unknown",
				clientType: clientType ?? "web",
			},
		});

		await this.identityService.warmSessionCache(user.id, profile);

		if (restriction.restricted) {
			return {
				requiresEnrollment: true,
				enrollmentReason: restriction.reason,
				message: restriction.message,
				user: profile,
				...tokens,
			};
		}

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
