import { randomUUID } from "node:crypto";

import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import {
	epochMs,
	type EpochMs,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type SessionLocation,
	type SessionSignInMethod,
	type UserPermissions,
} from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../../common/utils/expiry";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import type { SessionDeviceContext } from "../../sessions/device/session-device";
import { buildSessionDeviceLabel } from "../../sessions/device/session-device-label";
import { SessionLocationLookupService } from "../../sessions/location/session-location-lookup.service";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { IdentityService } from "./identity.service";
import { SessionRestrictionService } from "./session-restriction.service";
import { TokenService, type SessionScope, type SessionTokenGenerationOptions } from "./token.service";
import { CryptoService } from "./crypto.service";
import { UserResponseMapper } from "./user-response.mapper";

export interface IssueSessionOptions {
	readonly mfaAssured?: boolean | undefined;
}

/**
 * The sign-in a session is issued for: the device that receives the tokens
 * (the request completing the login) and the proofs the login flow required.
 */
export interface SessionSignIn {
	readonly device: SessionDeviceContext;
	readonly signInMethod: SessionSignInMethod;
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
		private readonly sessions: RefreshTokenRepository,
		private readonly locationLookup: SessionLocationLookupService,
		private readonly authorizationInvalidation: AuthorizationInvalidationService,
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

	/**
	 * Issue a session (one device session row + its token pair) to a user who
	 * passed every step of a login flow. `clientType` is the one the flow
	 * declared (merchant-access check); the stored session describes
	 * `signIn.device`, the request receiving the tokens.
	 */
	public async issueSessionForUser(
		userId: string,
		clientType: string | undefined,
		signIn: SessionSignIn,
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
		let merchantOrganizationSlug: string | undefined;
		if (clientType === "merchant") {
			const membership = await this.prisma.organizationMembership.findFirst({
				where: {
					userId: user.id,
					isDeleted: false,
					status: "ACTIVE",
					organization: { merchantProfile: { isNot: null }, isDeleted: false },
				},
				select: {
					id: true,
					organization: { select: { slug: true } },
				},
				orderBy: { createdAt: "asc" },
			});
			const canManageMerchants: boolean = userPermissions.permissions.some((permission) => permission.action === "MANAGE" && permission.resource === "MERCHANT_ORG");

			if (membership === null && !canManageMerchants) {
				const nowMs = Date.now();
				const pendingTeamInviteCount = await this.prisma.organizationInvitation.count({
					where: {
						email: user.email,
						kind: "TEAM_MEMBER",
						status: "PENDING",
						expiresAt: { gt: BigInt(nowMs) },
					},
				});

				if (pendingTeamInviteCount === 0) {
					throw new ForbiddenException({
						message: "Merchant access required. This account is not linked to a merchant organization.",
						error: "MERCHANT_ACCESS_REQUIRED",
					});
				}
			}

			merchantOrganizationSlug = membership?.organization.slug;
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

		const expiryMs = parseExpiryToMilliseconds(this.config.auth.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(now + expiryMs);

		// The session id is chosen first: it is the refresh token's `jti` and the
		// access token's `sid` (ADR 034), so the row is stored once, complete.
		const sessionId: string = randomUUID();
		const tokens = await this.tokenService.generateSessionTokens(flatUser, sessionId, tokenOptions);
		const location: SessionLocation | null = await this.locationLookup.lookup(signIn.device.ipAddress);

		await this.sessions.createSession({
			id: sessionId,
			userId: user.id,
			tokenHash: this.cryptoService.hashRefreshToken(tokens.refreshToken),
			device: signIn.device.device,
			ipAddress: signIn.device.ipAddress,
			location,
			signInMethod: signIn.signInMethod,
			createdAt: epochMs(now),
			expiresAt,
		});

		const retiredSessionIds: readonly string[] = await this.sessions.retireStaleSessions(user.id);
		if (retiredSessionIds.length > 0) {
			// A session retired above the cap may still hold an unexpired access token: reject its `sid` on every instance.
			await this.authorizationInvalidation.invalidateUsers([user.id], { accessTokenState: true, trigger: "session_revoked" });
		}

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
				sessionId,
				device: buildSessionDeviceLabel(signIn.device.device),
				signInMethod: signIn.signInMethod,
				ip: signIn.device.ipAddress ?? "Unknown",
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
				...(merchantOrganizationSlug !== undefined ? { organizationSlug: merchantOrganizationSlug } : {}),
				...tokens,
			};
		}

		return {
			user: profile,
			...tokens,
		};
	}
}
