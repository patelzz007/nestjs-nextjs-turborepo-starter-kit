import { Injectable } from "@nestjs/common";
import { epochMs, type AdminUserDetail, type AdminUserListQuery, type MessageResponse, type UserPermissions, type UserResponse } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { UserRepository } from "../repositories/user.repository";
import { UserResponseMapper } from "./user-response.mapper";

/**
 * Handles SuperAdmin user management: listing users, viewing user details
 * with security state, and unlocking locked accounts.
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class AdminUserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
	) {}

	public async getAdminUsersList(query: AdminUserListQuery): Promise<{
		readonly items: AdminUserDetail[];
		readonly total: number;
		readonly page: number;
		readonly limit: number;
		readonly totalPages: number;
		readonly hasNext: boolean;
		readonly hasPrevious: boolean;
	}> {
		const page: number = query.page;
		const limit: number = query.limit;

		const [users, total] = await Promise.all([this.userRepo.listAdminUsers(query), this.userRepo.countAdminUsers(query)]);

		const userIds: string[] = users.map((u) => u.id);
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId: { in: userIds }, isDeleted: false, role: { isDeleted: false } },
			include: {
				role: { select: { id: true, name: true, description: true } },
			},
		});

		const rolesByUserId = new Map<string, { id: string; name: string; description: string | null }[]>();
		for (const ur of userRoles) {
			const existing = rolesByUserId.get(ur.userId) ?? [];
			existing.push({
				id: ur.role.id,
				name: ur.role.name,
				description: ur.role.description,
			});
			rolesByUserId.set(ur.userId, existing);
		}

		const items: AdminUserDetail[] = users.map((u) => {
			const isEmailVerified: boolean = u.emailVerifiedAt !== null && u.emailVerifiedAt <= Date.now();
			const roles = rolesByUserId.get(u.id) ?? [];
			const hasAdminAccess: boolean = u.isSuperAdmin || roles.some((r) => r.name === "SuperAdmin" || r.name === "Admin" || r.name === "Manager");
			return {
				id: u.id,
				email: u.email,
				fullName: u.fullName,
				isActive: u.isActive,
				isSuperAdmin: u.isSuperAdmin,
				isEmailVerified,
				hasAdminAccess,
				tokenVersion: u.tokenVersion,
				roles,
				permissions: [],
				createdAt: epochMs(Number(u.createdAt)),
				updatedAt: epochMs(Number(u.updatedAt)),
				isDeleted: u.isDeleted,
				deletedAt: u.deletedAt !== null ? epochMs(Number(u.deletedAt)) : null,
				failedLoginAttempts: u.failedLoginAttempts,
				lockedUntil: u.lockedUntil !== null ? epochMs(Number(u.lockedUntil)) : null,
				directPermissionIds: [],
			};
		});

		const totalPages: number = limit === 0 ? 0 : Math.ceil(total / limit);
		return {
			items,
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		};
	}

	public async getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
		const user = await this.userRepo.findAdminDetailById(userId);

		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const directPermissionIds: readonly string[] = await this.authorizationChecker.getUserDirectPermissionIds(userId);
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const baseUser: UserResponse = this.mapper.build(user, userPermissions, isEmailVerified);

		return {
			...baseUser,
			permissions: userPermissions.permissions,
			failedLoginAttempts: user.failedLoginAttempts,
			lockedUntil: user.lockedUntil !== null ? epochMs(Number(user.lockedUntil)) : null,
			directPermissionIds: [...directPermissionIds],
		};
	}

	public async unlockUser(userId: string): Promise<MessageResponse> {
		await this.userRepo.findById(userId);

		await this.userRepo.update(userId, {
			failedLoginAttempts: 0,
			lockedUntil: null,
		});

		this.logService.info("User account unlocked by admin", {
			context: "AdminUserService",
			metadata: { targetUserId: userId },
		});

		return { message: "User account has been unlocked successfully." };
	}
}
