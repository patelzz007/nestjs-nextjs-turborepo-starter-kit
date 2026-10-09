import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AccessTokenPayload, ConsumerWebSignupInput, SignupResponse, SessionPermissionsResponse, UserResponse, UserPermissions } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
import { identifyAuthFlowSubject, TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { UserProvisioningService } from "./user-provisioning.service";
import { TokenService } from "./token.service";
import { UserResponseMapper } from "./user-response.mapper";
import { SignupReferralService } from "../signup-referrals/signup-referral.service";
import { isUniqueViolationOf } from "../../../platform/persistence/unique-violation";

/** Unique index on `users.email`: a violation means a concurrent signup took the email first. */
const USERS_EMAIL_UNIQUE_INDEX = "users_email_key";

/**
 * The one signup answer whether or not the email was free (and whether or not
 * a concurrent request took it first), so signup is not an account oracle.
 */
const GENERIC_SIGNUP_RESPONSE: SignupResponse = {
	message: "If this email is available, check your inbox for verification instructions.",
};

const SIGNUP_CREATED_USER_SELECT = {
	id: true,
	email: true,
	fullName: true,
	isActive: true,
	isSuperAdmin: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
	deletedAt: true,
} satisfies Prisma.UserSelect;

/** The account columns signup reads back after the insert. */
type SignupCreatedUser = Prisma.UserGetPayload<{ select: typeof SIGNUP_CREATED_USER_SELECT }>;

/**
 * Handles user identity operations: signup and profile retrieval (`/me`).
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class IdentityService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly cryptoService: CryptoService,
		private readonly tokenService: TokenService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly authEvents: AuthEventsService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
		private readonly sessionCache: UserSessionCacheService,
		private readonly emailService: EmailService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly config: TypedConfigService,
		private readonly signupReferrals: SignupReferralService,
	) {}

	@TrackAuthFlow({ flow: "signup" })
	public async signup(signupDto: ConsumerWebSignupInput, clientType?: string): Promise<SignupResponse> {
		const { email, password, fullName, referralCode } = signupDto;

		// The code is checked before the taken-email disguise: a bad code is a
		// validation error, never a generic "check your inbox" (ADR 035).
		const acceptedReferral = await this.signupReferrals.acceptCodeForSignup(referralCode, clientType);

		const emailTaken: boolean = await this.userRepo.existsByEmail(email);
		if (emailTaken) {
			return GENERIC_SIGNUP_RESPONSE;
		}

		const hashedPassword = await this.cryptoService.hash(password);
		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);
		const enrollmentDeadline = BigInt(Date.now() + this.config.mfa.enrollmentDeadlineMs);

		let newUser: SignupCreatedUser;
		try {
			newUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<SignupCreatedUser> => {
				const created = await tx.user.create({
					data: {
						email,
						passwordHash: hashedPassword,
						fullName,
						mfaEnrollmentDeadline: enrollmentDeadline,
					},
					select: SIGNUP_CREATED_USER_SELECT,
				});
				await this.signupReferrals.issueFirstCodeInTx(tx, created.id, Date.now());
				if (acceptedReferral !== null) {
					await this.signupReferrals.attachSignupReferralInTx(tx, acceptedReferral, { id: created.id, createdAt: Number(created.createdAt) });
				}
				return created;
			});
		} catch (error) {
			// A concurrent signup with the same email committed between the check
			// above and this insert: same generic answer, nothing created.
			if (error instanceof Error && isUniqueViolationOf(error, USERS_EMAIL_UNIQUE_INDEX)) {
				return GENERIC_SIGNUP_RESPONSE;
			}
			throw error;
		}

		identifyAuthFlowSubject(newUser.id);
		await this.userProvisioning.assignDefaultConsumerRole(newUser.id);
		const userPermissions = await this.authorizationChecker.getUserPermissionDetails(newUser.id);

		this.logService.info(`New user registered: ${newUser.email}`, {
			userId: newUser.id,
			context: "IdentityService",
			metadata: {
				email: newUser.email,
				fullName: newUser.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: newUser.isSuperAdmin ? "true" : "false",
			},
		});

		await this.emailService.sendVerificationEmail(newUser.email, verificationToken, clientType);

		return GENERIC_SIGNUP_RESPONSE;
	}

	public async getMe(userId: string): Promise<UserResponse> {
		const cached = await this.sessionCache.getMe(userId);
		if (cached !== null) {
			return cached;
		}
		const response = await this.getUserResponse(userId);
		await this.sessionCache.setMe(userId, response);
		return response;
	}

	public async getSessionPermissions(userId: string, accessPayload?: AccessTokenPayload): Promise<SessionPermissionsResponse> {
		const cached = await this.sessionCache.getPermissions(userId);
		const base = cached ?? (await this.buildAndCacheSessionPermissions(userId));
		const sessionScope = accessPayload?.sessionScope ?? "full";
		const enrollmentReason = sessionScope === "restricted" ? (accessPayload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment") : undefined;

		return {
			roles: base.roles,
			permissions: base.permissions,
			capabilities: base.capabilities,
			tokenVersion: base.tokenVersion,
			hasAdminAccess: base.hasAdminAccess,
			isImpersonating: accessPayload?.isImpersonating,
			originalUserId: accessPayload?.originalUserId,
			sessionScope,
			enrollmentReason,
		};
	}

	/**
	 * Warm Redis (or in-memory) session cache after login — shared by web, admin, and merchant.
	 */
	public async warmSessionCache(userId: string, profile: UserResponse): Promise<void> {
		await this.sessionCache.setMe(userId, profile);
		const permissions = await this.buildSessionPermissions(userId);
		await this.sessionCache.setPermissions(userId, permissions);
	}

	/**
	 * Drop cached `/auth/me` and `/auth/permissions` payloads for a user.
	 *
	 * Called when roles or permissions change so clients refetch fresh data.
	 */
	public invalidateMe(userId: string): void {
		void this.sessionCache.invalidate(userId);
	}

	/**
	 * Fetch a full UserResponse by ID. Also used by `LoginService` after
	 * successful authentication to build the response.
	 */
	public async getUserResponse(userId: string): Promise<UserResponse> {
		const user = await this.userRepo.findProfileById(userId);

		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();

		return this.mapper.build(user, userPermissions, isEmailVerified);
	}

	private async buildSessionPermissions(userId: string): Promise<SessionPermissionsResponse> {
		const user = await this.userRepo.findProfileById(userId);
		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const capabilities = await this.authorizationChecker.getUserCapabilitySlugs(userId);
		const profile = this.mapper.build(user, userPermissions, user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now());
		return {
			roles: userPermissions.roles,
			permissions: userPermissions.permissions,
			capabilities: [...capabilities],
			tokenVersion: profile.tokenVersion,
			hasAdminAccess: profile.hasAdminAccess,
			sessionScope: "full",
		};
	}

	private async buildAndCacheSessionPermissions(userId: string): Promise<SessionPermissionsResponse> {
		const response = await this.buildSessionPermissions(userId);
		await this.sessionCache.setPermissions(userId, response);
		return response;
	}
}
