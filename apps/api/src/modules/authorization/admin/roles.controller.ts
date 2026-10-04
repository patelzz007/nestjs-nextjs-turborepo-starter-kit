import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import {
	apiPath,
	RbacMessageResponseSchema,
	RoleAssignmentPreviewSchema,
	RoleAssignmentValidationResponseSchema,
	RoleListResponseSchema,
	RoleResponseSchema,
	UuidParamSchema,
	type RbacMessageResponse,
	type RoleAssignmentPreview,
	type RoleAssignmentValidationResponse,
	type RoleListItem,
	type RoleListResponse,
	type RoleResponse,
} from "@workspace/shared";
import { ConflictDetectionService } from "../services/conflict-detection.service";
import { AuthorizationService } from "../services/authorization.service";
import { ZodBody, ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import { Authorize } from "../decorators/authorize.decorator";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { CreateRoleDto, SetRoleParentDto, UpdateRoleDto, ValidateRoleAssignmentDto, AssignRoleToUserDto, SyncUserRolesDto } from "./dtos/role.dto";
import { SyncRolePermissionsDto } from "./dtos/permission.dto";
import { toRoleResponse } from "./mappers/rbac-response.mappers";
import { RoleAssignmentPreviewService } from "./services/role-assignment-preview.service";

// ── Controller ───────────────────────────────────────────────────────────────

@Controller(apiPath("/admin/roles"))
@ApiTags("Roles")
export class RolesController {
	public constructor(
		private readonly authorization: AuthorizationService,
		private readonly conflictDetection: ConflictDetectionService,
		private readonly assignmentPreview: RoleAssignmentPreviewService,
	) {}

	@Get()
	@SkipAuthThrottle()
	@RequirePermission("LIST", "ROLE")
	@ZodResponse(RoleListResponseSchema, { description: "List of roles" })
	public async list(): Promise<RoleListResponse> {
		const { items } = await this.authorization.roles.findAll({ limit: 200 });
		return {
			items: items.map((role): RoleListItem => ({
				id: role.id,
				name: role.name,
				description: role.description,
				isActive: role.isActive,
				parentId: role.parentId,
			})),
			total: items.length,
		};
	}

	@Post()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("CREATE", "ROLE")
	@Authorize({ action: "CREATE", resource: "ROLE", description: "Create new role" })
	@ZodResponse(RoleResponseSchema, { status: HttpStatus.CREATED, description: "Created role" })
	public async create(@CurrentUser() actor: AuthenticatedUser, @ZodBody(CreateRoleDto.schema) body: CreateRoleDto): Promise<RoleResponse> {
		const role = await this.authorization.roles.create(actor, {
			name: body.name,
			description: body.description,
			parentId: body.parentId,
		});
		return toRoleResponse(role);
	}

	// ── User role assignment (action-style) ───────────────────────────────

	@Post("user/assign")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		description: "Assign role to user",
	})
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role assigned to user" })
	public async assignRoleToUser(@CurrentUser() actor: AuthenticatedUser, @ZodBody(AssignRoleToUserDto.schema) body: AssignRoleToUserDto): Promise<RbacMessageResponse> {
		await this.authorization.roles.assignToUser(actor, body.userId, body.roleId);
		return { message: "Role assigned to user successfully" };
	}

	@Post("user/remove")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role removed from user" })
	public async removeRoleFromUser(@CurrentUser() actor: AuthenticatedUser, @ZodBody(AssignRoleToUserDto.schema) body: AssignRoleToUserDto): Promise<RbacMessageResponse> {
		await this.authorization.roles.removeFromUser(actor, body.userId, body.roleId);
		return { message: "Role removed from user successfully" };
	}

	@Post("user/sync")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "User roles synced" })
	public async syncUserRoles(@CurrentUser() actor: AuthenticatedUser, @ZodBody(SyncUserRolesDto.schema) body: SyncUserRolesDto): Promise<RbacMessageResponse> {
		await this.authorization.roles.syncUserRoles(actor, body.userId, body.roleIds);
		return { message: "User roles synced successfully" };
	}

	@Get(":id")
	@RequirePermission("READ", "ROLE")
	@ZodResponse(RoleResponseSchema, { description: "Role detail (404 NOT_FOUND when no live role has that id)" })
	public async detail(@ZodParam("id", UuidParamSchema) id: string): Promise<RoleResponse> {
		const role = await this.authorization.roles.findById(id);
		if (role === null) {
			throw new ResourceNotFoundError(id);
		}
		return toRoleResponse(role);
	}

	@Patch(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { description: "Updated role" })
	public async update(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(UpdateRoleDto.schema) body: UpdateRoleDto,
	): Promise<RoleResponse> {
		const role = await this.authorization.roles.update(actor, id, {
			...(body.name !== undefined ? { name: body.name } : {}),
			...(body.description !== undefined ? { description: body.description } : {}),
			...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
		});
		return toRoleResponse(role);
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { description: "Role deleted" })
	public async remove(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.authorization.roles.remove(actor, id);
		return { message: "Role deleted successfully" };
	}

	@Patch(":id/parent")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { description: "Parent role updated" })
	public async setParent(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(SetRoleParentDto.schema) body: SetRoleParentDto,
	): Promise<RoleResponse> {
		return toRoleResponse(await this.authorization.roles.setParent(actor, id, body.parentId));
	}

	@Post(":id/permissions")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role permissions synced" })
	public async syncPermissions(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(SyncRolePermissionsDto.schema) body: SyncRolePermissionsDto,
	): Promise<RbacMessageResponse> {
		await this.authorization.roles.syncPermissions(actor, id, body.permissionIds);
		return { message: "Role permissions synced successfully" };
	}

	@Post(":id/restore")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { status: HttpStatus.CREATED, description: "Restored role" })
	public async restore(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<RoleResponse> {
		return toRoleResponse(await this.authorization.roles.restore(actor, id));
	}

	// ── Conflict detection ────────────────────────────────────────────────

	@Post(":id/validate-assignment")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleAssignmentValidationResponseSchema, { status: HttpStatus.CREATED, description: "Conflict validation result" })
	public async validateAssignment(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) _id: string,
		@ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto,
	): Promise<RoleAssignmentValidationResponse> {
		await this.conflictDetection.validateProposedAssignment(actor.id, body.userId, body.roleIds);
		return { valid: true, message: "No conflicts detected" };
	}

	// ── Permission preview ────────────────────────────────────────────────

	@Post("preview")
	@RequirePermission("READ", "ROLE")
	@ZodResponse(RoleAssignmentPreviewSchema, { status: HttpStatus.CREATED, description: "Preview of what permissions would change" })
	public async preview(@CurrentUser() actor: AuthenticatedUser, @ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto): Promise<RoleAssignmentPreview> {
		return this.assignmentPreview.preview(actor.id, body.userId, body.roleIds);
	}
}
