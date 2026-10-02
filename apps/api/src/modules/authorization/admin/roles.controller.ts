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
	RoleDetailResponseSchema,
	RoleListResponseSchema,
	RoleResponseSchema,
	UuidParamSchema,
	type RbacMessageResponse,
	type RoleAssignmentPreview,
	type RoleAssignmentValidationResponse,
	type RoleDetailResponse,
	type RoleListItem,
	type RoleListResponse,
	type RoleResponse,
} from "@workspace/shared";
import { ConflictDetectionService } from "../services/conflict-detection.service";
import { AuthorizationService } from "../services/authorization.service";
import { ZodBody, ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Authorize } from "../decorators/authorize.decorator";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { PrivilegeEscalationService } from "../services/privilege-escalation.service";
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
		private readonly escalation: PrivilegeEscalationService,
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
		if (body.parentId !== undefined) {
			await this.escalation.assertCanGrantRoles(actor, [body.parentId]);
		}
		const role = await this.authorization.roles.create(
			{
				name: body.name,
				description: body.description,
				parentId: body.parentId,
			},
			actor.id,
		);
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
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantRoles(actor, [body.roleId]);
		await this.authorization.roles.assignToUser(body.userId, body.roleId, actor.id);
		return { message: "Role assigned to user successfully" };
	}

	@Post("user/remove")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role removed from user" })
	public async removeRoleFromUser(@CurrentUser() actor: AuthenticatedUser, @ZodBody(AssignRoleToUserDto.schema) body: AssignRoleToUserDto): Promise<RbacMessageResponse> {
		this.escalation.assertNotSelf(actor, body.userId);
		await this.authorization.roles.removeFromUser(body.userId, body.roleId, actor.id);
		return { message: "Role removed from user successfully" };
	}

	@Post("user/sync")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "User roles synced" })
	public async syncUserRoles(@CurrentUser() actor: AuthenticatedUser, @ZodBody(SyncUserRolesDto.schema) body: SyncUserRolesDto): Promise<RbacMessageResponse> {
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantRoles(actor, body.roleIds);
		await this.authorization.roles.syncUserRoles(body.userId, body.roleIds, actor.id);
		return { message: "User roles synced successfully" };
	}

	@Get(":id")
	@RequirePermission("READ", "ROLE")
	@ZodResponse(RoleDetailResponseSchema, { description: "Role detail, or `null` when no role has that id" })
	public async detail(@ZodParam("id", UuidParamSchema) id: string): Promise<RoleDetailResponse> {
		const role = await this.authorization.roles.findById(id);
		return role === null ? null : toRoleResponse(role);
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
		await this.escalation.assertNotHoldingRole(actor, id);
		if (body.isActive === true) {
			await this.escalation.assertCanGrantRoles(actor, [id]);
		}
		const role = await this.authorization.roles.updateAs(
			id,
			{
				...(body.name !== undefined ? { name: body.name } : {}),
				...(body.description !== undefined ? { description: body.description } : {}),
				...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
			},
			actor.id,
		);
		return toRoleResponse(role);
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { description: "Role deleted" })
	public async remove(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.authorization.roles.remove(id, actor.id);
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
		await this.escalation.assertNotHoldingRole(actor, id);
		if (body.parentId !== null) {
			await this.escalation.assertCanGrantRoles(actor, [body.parentId]);
		}
		return toRoleResponse(await this.authorization.roles.setParent(id, body.parentId, actor.id));
	}

	@Post(":id/permissions")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role permissions synced" })
	public async syncPermissions(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(SyncRolePermissionsDto.schema) body: SyncRolePermissionsDto,
	): Promise<RbacMessageResponse> {
		await this.escalation.assertNotHoldingRole(actor, id);
		await this.escalation.assertCanGrantPermissions(actor, body.permissionIds);
		await this.authorization.roles.syncPermissions(id, body.permissionIds, actor.id);
		return { message: "Role permissions synced successfully" };
	}

	@Post(":id/restore")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { status: HttpStatus.CREATED, description: "Restored role" })
	public async restore(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<RoleResponse> {
		await this.escalation.assertCanGrantRoles(actor, [id]);
		return toRoleResponse(await this.authorization.roles.restore(id));
	}

	// ── Conflict detection ────────────────────────────────────────────────

	@Post(":id/validate-assignment")
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleAssignmentValidationResponseSchema, { status: HttpStatus.CREATED, description: "Conflict validation result" })
	public async validateAssignment(
		@ZodParam("id", UuidParamSchema) _id: string,
		@ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto,
	): Promise<RoleAssignmentValidationResponse> {
		await this.conflictDetection.validate(body.userId, body.roleIds);
		return { valid: true, message: "No conflicts detected" };
	}

	// ── Permission preview ────────────────────────────────────────────────

	@Post("preview")
	@RequirePermission("READ", "ROLE")
	@ZodResponse(RoleAssignmentPreviewSchema, { status: HttpStatus.CREATED, description: "Preview of what permissions would change" })
	public async preview(@ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto): Promise<RoleAssignmentPreview> {
		return this.assignmentPreview.preview(body.userId, body.roleIds);
	}
}
