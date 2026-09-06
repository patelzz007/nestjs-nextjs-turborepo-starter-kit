import { Injectable } from "@nestjs/common";
import type { Permission, UserPermission, UserRole } from "@prisma/client";

import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RoleAssignmentRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findActiveUserIdsByRole(roleId: string): Promise<string[]> {
		const rows = await this.prisma.userRole.findMany({
			where: { roleId, isDeleted: false },
			select: { userId: true },
		});
		return rows.map((row) => row.userId);
	}

	public async givePermissionToRole(roleId: string, permissionId: string): Promise<void> {
		await this.prisma.rolePermission.upsert({
			where: { roleId_permissionId: { roleId, permissionId } },
			create: { roleId, permissionId },
			update: { isDeleted: false, deletedAt: null },
		});
	}

	public async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
		await this.prisma.rolePermission.updateMany({
			where: { roleId, permissionId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});
	}

	public async syncRolePermissions(roleId: string, permissionIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.rolePermission.updateMany({
				where: { roleId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});
			if (permissionIds.length > 0) {
				await tx.rolePermission.createMany({
					data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
					skipDuplicates: true,
				});
			}
		});
	}

	public async assignRoleToUser(userId: string, roleId: string): Promise<UserRole> {
		return this.prisma.userRole.upsert({
			where: { userId_roleId: { userId, roleId } },
			create: { userId, roleId },
			update: { isDeleted: false, deletedAt: null },
		});
	}

	public async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
		await this.prisma.userRole.updateMany({
			where: { userId, roleId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});
	}

	public async syncUserRoles(userId: string, roleIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.userRole.updateMany({
				where: { userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});
			if (roleIds.length > 0) {
				await tx.userRole.createMany({
					data: roleIds.map((roleId) => ({ userId, roleId })),
					skipDuplicates: true,
				});
			}
		});
	}

	public async findPermissionById(permissionId: string): Promise<Permission | null> {
		return this.prisma.permission.findFirst({
			where: { id: permissionId, isDeleted: false },
		});
	}

	public async givePermissionToUser(userId: string, permissionId: string, expiresAt?: number): Promise<UserPermission> {
		return this.prisma.userPermission.upsert({
			where: { userId_permissionId: { userId, permissionId } },
			create: { userId, permissionId, expiresAt: expiresAt ?? null },
			update: {
				isDeleted: false,
				deletedAt: null,
				...(expiresAt !== undefined ? { expiresAt } : {}),
			},
		});
	}

	public async revokePermissionFromUser(userId: string, permissionId: string): Promise<void> {
		await this.prisma.userPermission.updateMany({
			where: { userId, permissionId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});
	}

	public async syncUserPermissions(userId: string, permissionIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.userPermission.updateMany({
				where: { userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});
			if (permissionIds.length > 0) {
				await tx.userPermission.createMany({
					data: permissionIds.map((permissionId) => ({ userId, permissionId })),
					skipDuplicates: true,
				});
			}
		});
	}

	public async findAffectedUserIdsByPermission(permissionId: string): Promise<string[]> {
		const [rolePerms, directPerms] = await Promise.all([
			this.prisma.rolePermission.findMany({
				where: { permissionId, isDeleted: false },
				select: { roleId: true },
			}),
			this.prisma.userPermission.findMany({
				where: { permissionId, isDeleted: false },
				select: { userId: true },
			}),
		]);

		const userIds = new Set<string>(directPerms.map((row) => row.userId));
		if (rolePerms.length > 0) {
			const roleIds = rolePerms.map((row) => row.roleId);
			const userRoles = await this.prisma.userRole.findMany({
				where: { roleId: { in: roleIds }, isDeleted: false },
				select: { userId: true },
			});
			for (const userRole of userRoles) {
				userIds.add(userRole.userId);
			}
		}
		return Array.from(userIds);
	}
}
