import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ImpersonateResponse, StopImpersonationResponse, UserResponse } from "@workspace/shared";

import { LogService } from "../../modules/logs/logs.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import { AuthService } from "../auth/auth.service.js";
import { TokenService } from "../auth/services/token.service.js";
import { ImpersonationActionEventSchema, ImpersonationEventsService } from "./impersonation-events.service.js";

/**
 * SuperAdmin impersonation flows — starting and stopping impersonation,
 * including audit-log persistence for both actions.
 *
 * Split out of the (previously monolithic) `AuthService` — see
 * `docs/architecture.md` (module layout convention).
 */
@Injectable()
export class ImpersonationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly tokenService: TokenService,
		private readonly rbacService: RbacService,
		private readonly logService: LogService,
		private readonly authService: AuthService,
		private readonly impersonationEvents: ImpersonationEventsService,
	) {}

	/**
	 * SuperAdmin impersonates another user.
	 * Returns a short-lived access token for the target user with impersonation
	 * claims embedded in the JWT payload.
	 *
	 * Rules:
	 * - Only isSuperAdmin users can impersonate
	 * - Cannot impersonate other superadmins
	 * - Target user must exist and be active
	 */
	public async impersonateUser(superAdminId: string, targetUserId: string, ipAddress?: string, userAgent?: string | null): Promise<ImpersonateResponse> {
		const actionStartedAt: number = performance.now();

		// 1. Verify the impersonator is a superadmin
		const superAdmin = await this.prisma.user.findUnique({
			where: { id: superAdminId },
			select: { id: true, isSuperAdmin: true },
		});

		if (!superAdmin?.isSuperAdmin) {
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
		const userPermissions = await this.rbacService.getUserPermissions(targetUser.id);
		const isEmailVerified = targetUser.emailVerifiedAt !== null && targetUser.emailVerifiedAt <= new Date();
		const flatUser: UserResponse = this.authService.buildUserResponse(targetUser, userPermissions, isEmailVerified);

		// 5. Generate impersonation token
		const accessToken = await this.tokenService.generateImpersonationToken(flatUser, superAdmin.id);

		// 6. Persist audit log entry
		await this.prisma.impersonationAuditLog.create({
			data: {
				impersonatorId: superAdmin.id,
				targetUserId: targetUser.id,
				action: "START",
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
			},
		});

		// 7. Application-level audit log
		this.logService.warn("SuperAdmin impersonation started", {
			context: "ImpersonationService",
			metadata: {
				superAdminId: superAdmin.id,
				targetUserId: targetUser.id,
			},
		});

		this.impersonationEvents.emitAction(
			ImpersonationActionEventSchema.parse({
				action: "start",
				superAdminId: superAdmin.id,
				targetUserId: targetUser.id,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - actionStartedAt),
			}),
		);

		return {
			accessToken,
			message: `Now impersonating ${targetUser.email}`,
			impersonating: true,
			originalUserId: superAdmin.id,
			user: flatUser,
		};
	}

	/**
	 * Stop impersonating.
	 * Returns a confirmation message. The frontend should discard the
	 * impersonation token and restore the original session.
	 *
	 * @param impersonatorId - The SuperAdmin's original user ID (from originalUserId claim)
	 * @param targetUserId - The user who was being impersonated (from sub claim)
	 */
	public async stopImpersonation(impersonatorId: string, targetUserId: string, ipAddress?: string, userAgent?: string | null): Promise<StopImpersonationResponse> {
		const actionStartedAt: number = performance.now();

		// Persist audit log entry with both IDs correctly recorded
		await this.prisma.impersonationAuditLog.create({
			data: {
				impersonatorId,
				targetUserId,
				action: "STOP",
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
			},
		});

		this.logService.warn("SuperAdmin impersonation ended", {
			context: "ImpersonationService",
			metadata: {
				impersonatorId: impersonatorId,
				targetUserId: targetUserId,
			},
		});

		this.impersonationEvents.emitAction(
			ImpersonationActionEventSchema.parse({
				action: "stop",
				superAdminId: impersonatorId,
				targetUserId,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - actionStartedAt),
			}),
		);

		return {
			message: "Impersonation ended. Original session restored.",
		};
	}
}
