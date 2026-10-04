import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
	ImpersonationActionEventSchema,
	nowEpochMs,
	type ImpersonateServiceResponse,
	type StopImpersonationServiceResponse,
	type UserResponse,
	type FlatUserResponse,
} from "@workspace/shared";

import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { LogService } from "../../modules/logs/logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { ImpersonationSessionRepository } from "../auth/repositories/impersonation-session.repository";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { IMPERSONATION_TOKEN_TTL_SECONDS } from "../auth/constants/impersonation.constants";
import { TokenService } from "../auth/services/token.service";

/** Milliseconds per second — converts the impersonation token TTL to the session's epoch-ms expiry. */
const MS_PER_SECOND = 1000;

/** The account state that decides whether a user may act as (or be restored as) a SuperAdmin. */
interface SuperAdminEligibility {
	readonly isSuperAdmin: boolean;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
}

function isEligibleSuperAdmin(user: SuperAdminEligibility | null): boolean {
	return user !== null && user.isSuperAdmin && user.isActive && !user.isDeleted;
}

/**
 * SuperAdmin impersonation flows — starting and stopping impersonation.
 *
 * Every impersonation is a server-side `ImpersonationSession`: the token is
 * bound to it, `AuthGuard` rejects the token once the session ended, and the
 * START/STOP audit rows + `impersonation.action` events commit atomically with
 * the session write (see `ImpersonationSessionRepository`).
 *
 * Split out of the (previously monolithic) `AuthService` — see
 * `docs/technical/security/authentication.md` (module split).
 */
@Injectable()
export class ImpersonationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly sessions: ImpersonationSessionRepository,
		private readonly tokenService: TokenService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
		private readonly outbox: PlatformOutboxService,
	) {}

	/**
	 * SuperAdmin impersonates another user.
	 * Returns a short-lived access token for the target user with impersonation
	 * claims embedded in the JWT payload.
	 *
	 * Rules:
	 * - Only active, non-deleted isSuperAdmin users can impersonate
	 * - Cannot impersonate other superadmins
	 * - Target user must exist and be active
	 */
	public async impersonateUser(superAdminId: string, targetUserId: string, ipAddress?: string, userAgent?: string | null): Promise<ImpersonateServiceResponse> {
		const actionStartedAt: number = performance.now();

		// 1. Verify the impersonator is a superadmin
		const superAdmin = await this.prisma.user.findUnique({
			where: { id: superAdminId },
			select: { id: true, isSuperAdmin: true, isActive: true, isDeleted: true },
		});

		if (superAdmin === null || !isEligibleSuperAdmin(superAdmin)) {
			throw new ForbiddenException("Only super administrators can impersonate users");
		}

		// 2. Cannot impersonate yourself
		if (superAdminId === targetUserId) {
			throw new BadRequestException("Cannot impersonate yourself");
		}

		// 3. Verify target user exists, is active, and is not a superadmin
		const targetUser = await this.prisma.user.findUnique({
			where: { id: targetUserId },
			select: {
				id: true,
				email: true,
				fullName: true,
				isActive: true,
				isSuperAdmin: true,
				isDeleted: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				deletedAt: true,
			},
		});

		if (!targetUser) {
			throw new NotFoundException("Target user not found");
		}

		if (!targetUser.isActive || targetUser.isDeleted) {
			throw new BadRequestException("Cannot impersonate an inactive or deleted user");
		}

		if (targetUser.isSuperAdmin) {
			throw new ForbiddenException("Cannot impersonate another super administrator");
		}

		// 4. Get target user's permissions
		const userPermissions = await this.authorizationChecker.getUserPermissionDetails(targetUser.id);
		const isEmailVerified = targetUser.emailVerifiedAt !== null && targetUser.emailVerifiedAt <= Date.now();
		const flatUser: FlatUserResponse = this.mapper.toFlatUser(targetUser, userPermissions, isEmailVerified);
		const profile: UserResponse = this.mapper.build(targetUser, userPermissions, isEmailVerified);

		// 5. Persist the session + START audit row, sign the session-bound token,
		//    and record the platform event — atomically (transactional outbox).
		const startedAt: number = nowEpochMs();
		const accessToken: string = await this.sessions.start(
			{
				impersonatorId: superAdmin.id,
				targetUserId: targetUser.id,
				startedAt,
				expiresAt: startedAt + IMPERSONATION_TOKEN_TTL_SECONDS * MS_PER_SECOND,
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
			},
			async (tx, sessionId): Promise<string> => {
				const token: string = await this.tokenService.generateImpersonationToken(flatUser, superAdmin.id, sessionId);
				await this.outbox.enqueueInTransaction(tx, {
					type: "impersonation.action",
					payload: ImpersonationActionEventSchema.parse({
						action: "start",
						superAdminId: superAdmin.id,
						targetUserId: targetUser.id,
						status: "succeeded",
						error: null,
						durationMs: Math.round(performance.now() - actionStartedAt),
					}),
				});
				return token;
			},
		);

		// 6. Application-level log
		this.logService.warn("SuperAdmin impersonation started", {
			context: "ImpersonationService",
			metadata: {
				superAdminId: superAdmin.id,
				targetUserId: targetUser.id,
			},
		});

		return {
			accessToken,
			message: `Now impersonating ${targetUser.email}`,
			impersonating: true,
			originalUserId: superAdmin.id,
			user: profile,
		};
	}

	/**
	 * Stop impersonating and restore the original SuperAdmin session.
	 *
	 * Order matters: the original administrator is validated FIRST (still an
	 * active, non-deleted SuperAdmin — otherwise nothing is restored), then the
	 * impersonation session is ended with a compare-and-set, and the STOP audit
	 * row (actor = the impersonator) + event commit in that same transaction.
	 * Ending the session revokes the impersonation token server-side.
	 *
	 * @param impersonatorId - The SuperAdmin's original user ID (from the `originalUserId` claim)
	 * @param targetUserId - The user who was being impersonated (from the `sub` claim)
	 * @param sessionId - The impersonation session (from the `impersonationSessionId` claim)
	 */
	public async stopImpersonation(
		impersonatorId: string,
		targetUserId: string,
		sessionId: string,
		ipAddress?: string,
		userAgent?: string | null,
	): Promise<StopImpersonationServiceResponse> {
		const actionStartedAt: number = performance.now();

		const impersonator = await this.prisma.user.findUnique({
			where: { id: impersonatorId },
			select: {
				id: true,
				email: true,
				fullName: true,
				isActive: true,
				isSuperAdmin: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});

		if (impersonator === null) {
			throw new NotFoundException("Original administrator account not found");
		}

		if (!isEligibleSuperAdmin(impersonator)) {
			throw new ForbiddenException({
				message: "The original administrator account can no longer be restored",
				error: "IMPERSONATOR_NOT_ELIGIBLE",
			});
		}

		const userPermissions = await this.authorizationChecker.getUserPermissionDetails(impersonatorId);
		const isEmailVerified = impersonator.emailVerifiedAt !== null && impersonator.emailVerifiedAt <= Date.now();
		const flatUser: FlatUserResponse = this.mapper.toFlatUser(impersonator, userPermissions, isEmailVerified);

		const ended: boolean = await this.sessions.end(
			{ sessionId, impersonatorId, targetUserId, endedAt: nowEpochMs(), ipAddress: ipAddress ?? null, userAgent: userAgent ?? null },
			async (tx): Promise<void> => {
				await this.outbox.enqueueInTransaction(tx, {
					type: "impersonation.action",
					payload: ImpersonationActionEventSchema.parse({
						action: "stop",
						superAdminId: impersonatorId,
						targetUserId,
						status: "succeeded",
						error: null,
						durationMs: Math.round(performance.now() - actionStartedAt),
					}),
				});
			},
		);

		if (!ended) {
			throw new UnauthorizedException({
				message: "Impersonation session has ended or is no longer valid",
				error: "IMPERSONATION_SESSION_INVALID",
			});
		}

		const accessToken = await this.tokenService.generateAccessToken(flatUser);

		this.logService.warn("SuperAdmin impersonation ended", {
			context: "ImpersonationService",
			metadata: {
				impersonatorId,
				targetUserId,
				sessionId,
			},
		});

		return {
			message: "Impersonation ended. Original session restored.",
			accessToken,
		};
	}
}
