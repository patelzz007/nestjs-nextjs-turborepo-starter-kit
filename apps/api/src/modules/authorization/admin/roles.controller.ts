import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { apiPath, type PermissionListItem, type RoleListItem } from "@workspace/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { ConflictDetectionService } from "../services/conflict-detection.service";
import { AuthorizationService } from "../services/authorization.service";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { CreateRoleDto, SetRoleParentDto, UpdateRoleDto, ValidateRoleAssignmentDto, AssignRoleToUserDto, SyncUserRolesDto } from "./dtos/role.dto";
import { SyncRolePermissionsDto } from "./dtos/permission.dto";

// ── Controller ───────────────────────────────────────────────────────────────

@Controller(apiPath("/admin/roles"))
@ApiTags("Roles")
export class RolesController {
	public constructor(
		private readonly authorization: AuthorizationService,
		private readonly conflictDetection: ConflictDetectionService,
		private readonly prisma: PrismaService,
	) {}

	@Get()
	@SkipThrottle()
	@RequirePermission("LIST", "ROLE")
	@ApiOkResponse({ description: "List of roles" })
	public async list(): Promise<{ readonly items: readonly RoleListItem[]; readonly total: number }> {
		const { items, total } = await this.authorization.roles.findAll({ limit: 200 });
		return {
			items: items.map((role): RoleListItem => ({
				id: role.id,
				name: role.name,
				description: role.description,
				isActive: role.isActive,
				parentId: role.parentId,
			})),
			total,
		};
	}

	@Post()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("CREATE", "ROLE")
	@ApiBody({ type: CreateRoleDto })
	@ApiOkResponse({ description: "Created role" })
	public async create(@Body(new ZodValidationPipe(CreateRoleDto.schema)) body: CreateRoleDto): Promise<unknown> {
		return this.authorization.roles.create({
			name: body.name,
			description: body.description,
			parentId: body.parentId,
		});
	}

	// ── User role assignment (action-style) ───────────────────────────────

	@Post("user/assign")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: AssignRoleToUserDto })
	@ApiOkResponse({ description: "Role assigned to user" })
	public async assignRoleToUser(@Body(new ZodValidationPipe(AssignRoleToUserDto.schema)) body: AssignRoleToUserDto): Promise<unknown> {
		await this.authorization.roles.assignToUser(body.userId, body.roleId);
		return { message: "Role assigned to user successfully" };
	}

	@Post("user/remove")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: AssignRoleToUserDto })
	@ApiOkResponse({ description: "Role removed from user" })
	public async removeRoleFromUser(@Body(new ZodValidationPipe(AssignRoleToUserDto.schema)) body: AssignRoleToUserDto): Promise<unknown> {
		await this.authorization.roles.removeFromUser(body.userId, body.roleId);
		return { message: "Role removed from user successfully" };
	}

	@Post("user/sync")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: SyncUserRolesDto })
	@ApiOkResponse({ description: "User roles synced" })
	public async syncUserRoles(@Body(new ZodValidationPipe(SyncUserRolesDto.schema)) body: SyncUserRolesDto): Promise<unknown> {
		await this.authorization.roles.syncUserRoles(body.userId, body.roleIds);
		return { message: "User roles synced successfully" };
	}

	@Get(":id")
	@RequirePermission("READ", "ROLE")
	@ApiOkResponse({ description: "Role detail" })
	public async detail(@Param("id") id: string): Promise<unknown> {
		return this.authorization.roles.findById(id);
	}

	@Patch(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: UpdateRoleDto })
	@ApiOkResponse({ description: "Updated role" })
	public async update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateRoleDto.schema)) body: UpdateRoleDto): Promise<unknown> {
		return this.authorization.roles.update(id, {
			...(body.name !== undefined ? { name: body.name } : {}),
			...(body.description !== undefined ? { description: body.description } : {}),
			...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
		});
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "ROLE")
	@ApiOkResponse({ description: "Role deleted" })
	public async remove(@Param("id") id: string): Promise<unknown> {
		await this.authorization.roles.remove(id);
		return { message: "Role deleted successfully" };
	}

	@Patch(":id/parent")
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: SetRoleParentDto })
	@ApiOkResponse({ description: "Parent role updated" })
	public async setParent(@Param("id") id: string, @Body(new ZodValidationPipe(SetRoleParentDto.schema)) body: SetRoleParentDto): Promise<unknown> {
		return this.authorization.roles.setParent(id, body.parentId);
	}

	@Post(":id/permissions")
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: SyncRolePermissionsDto })
	@ApiOkResponse({ description: "Role permissions synced" })
	public async syncPermissions(@Param("id") id: string, @Body(new ZodValidationPipe(SyncRolePermissionsDto.schema)) body: SyncRolePermissionsDto): Promise<unknown> {
		await this.authorization.roles.syncPermissions(id, body.permissionIds);
		return { message: "Role permissions synced successfully" };
	}

	@Post(":id/restore")
	@RequirePermission("UPDATE", "ROLE")
	@ApiOkResponse({ description: "Restored role" })
	public async restore(@Param("id") id: string): Promise<unknown> {
		return this.authorization.roles.restore(id);
	}

	// ── Conflict detection ────────────────────────────────────────────────

	@Post(":id/validate-assignment")
	@RequirePermission("UPDATE", "ROLE")
	@ApiBody({ type: ValidateRoleAssignmentDto })
	@ApiOkResponse({ description: "Conflict validation result" })
	public async validateAssignment(@Param("id") _id: string, @Body(new ZodValidationPipe(ValidateRoleAssignmentDto.schema)) body: ValidateRoleAssignmentDto): Promise<unknown> {
		await this.conflictDetection.validate(body.userId, body.roleIds);
		return { valid: true, message: "No conflicts detected" };
	}

	// ── Permission preview ────────────────────────────────────────────────

	@Post("preview")
	@RequirePermission("READ", "ROLE")
	@ApiBody({ type: ValidateRoleAssignmentDto })
	@ApiOkResponse({ description: "Preview of what permissions would change" })
	public async preview(@Body(new ZodValidationPipe(ValidateRoleAssignmentDto.schema)) body: ValidateRoleAssignmentDto): Promise<unknown> {
		// Fetch current permissions
		const currentPerms = await this.authorization.checkerService.getUserPermissionDetails(body.userId);
		const currentPermSet: Set<string> = new Set<string>(currentPerms.permissions.map((p) => `${p.action}:${p.resource}`));
		const currentRoleSet: Set<string> = new Set<string>(currentPerms.roles.map((r) => r.name));

		// Simulate new roles
		const newRoles = await this.prisma.role.findMany({
			where: { id: { in: [...body.roleIds] }, isDeleted: false },
			include: {
				rolePermissions: { include: { permission: { select: { action: true, resource: true } } } },
			},
		});

		const newPermSet: Set<string> = new Set<string>();
		const newRoleNames: string[] = [];
		for (const role of newRoles) {
			newRoleNames.push(role.name);
			for (const rp of role.rolePermissions) {
				if (!rp.isDeleted) {
					newPermSet.add(`${rp.permission.action}:${rp.permission.resource}`);
				}
			}
		}

		// Compute diff
		const gained: string[] = [...newPermSet].filter((p) => !currentPermSet.has(p));
		const lost: string[] = [...currentPermSet].filter((p) => !newPermSet.has(p));
		const roleAdded: string[] = newRoleNames.filter((r) => !currentRoleSet.has(r));
		const roleRemoved: string[] = [...currentRoleSet].filter((r) => !newRoleNames.includes(r));

		return {
			currentRoles: [...currentRoleSet],
			newRoles: newRoleNames,
			roleAdded,
			roleRemoved,
			permissionsGained: gained,
			permissionsLost: lost,
		};
	}
}
