import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import {
	AdminPermissionDetailResponseSchema,
	AdminPermissionResponseSchema,
	apiPath,
	CheckPermissionResponseSchema,
	PermissionGroupsResponseSchema,
	PermissionListResponseSchema,
	RbacMessageResponseSchema,
	UuidParamSchema,
	type AdminPermissionDetailResponse,
	type AdminPermissionResponse,
	type CheckPermissionResponse,
	type PermissionGroupsResponse,
	type PermissionListItem,
	type PermissionListResponse,
	type RbacMessageResponse,
} from "@workspace/shared";
import { AuthorizationService } from "../services/authorization.service";
import { ZodBody, ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Authorize } from "../decorators/authorize.decorator";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { PrivilegeEscalationService } from "../services/privilege-escalation.service";
import { CreatePermissionDto, GrantPermissionToUserDto, SyncUserPermissionsDto, CheckPermissionDto, UpdatePermissionDto } from "./dtos/permission.dto";
import { toAdminPermissionResponse } from "./mappers/rbac-response.mappers";

// ── Controller ───────────────────────────────────────────────────────────────

@Controller(apiPath("/admin/permissions"))
@ApiTags("Permissions")
export class PermissionsController {
	public constructor(
		private readonly authorization: AuthorizationService,
		private readonly escalation: PrivilegeEscalationService,
	) {}

	@Get()
	@SkipAuthThrottle()
	@RequirePermission("LIST", "PERMISSION")
	@ZodResponse(PermissionListResponseSchema, { description: "List of permissions" })
	public async list(): Promise<PermissionListResponse> {
		const { items } = await this.authorization.permissions.findAll({ limit: 500 });
		return {
			items: items.map((permission): PermissionListItem => ({
				id: permission.id,
				action: permission.action,
				resource: permission.resource,
				description: permission.description,
				group: permission.group,
				isSystem: permission.isSystem,
			})),
			total: items.length,
		};
	}

	@Post()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("CREATE", "PERMISSION")
	@Authorize({ action: "CREATE", resource: "PERMISSION", description: "Create new permission" })
	@ZodResponse(AdminPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Created permission" })
	public async create(@ZodBody(CreatePermissionDto.schema) body: CreatePermissionDto): Promise<AdminPermissionResponse> {
		const permission = await this.authorization.permissions.create({
			action: body.action,
			resource: body.resource,
			description: body.description,
			group: body.group,
			isSystem: body.isSystem,
		});
		return toAdminPermissionResponse(permission);
	}

	@Get(":id")
	@RequirePermission("READ", "PERMISSION")
	@ZodResponse(AdminPermissionDetailResponseSchema, { description: "Permission detail, or `null` when no permission has that id" })
	public async detail(@ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionDetailResponse> {
		const permission = await this.authorization.permissions.findById(id);
		return permission === null ? null : toAdminPermissionResponse(permission);
	}

	@Patch(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@Authorize({ action: "UPDATE", resource: "PERMISSION", resourceId: "id", description: "Update permission" })
	@ZodResponse(AdminPermissionResponseSchema, { description: "Updated permission" })
	public async update(@ZodParam("id", UuidParamSchema) id: string, @ZodBody(UpdatePermissionDto.schema) body: UpdatePermissionDto): Promise<AdminPermissionResponse> {
		const permission = await this.authorization.permissions.update(id, {
			...(body.description !== undefined ? { description: body.description } : {}),
			...(body.group !== undefined ? { group: body.group } : {}),
			...(body.isSystem !== undefined ? { isSystem: body.isSystem } : {}),
		});
		return toAdminPermissionResponse(permission);
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { description: "Permission deleted" })
	public async remove(@ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.authorization.permissions.remove(id);
		return { message: "Permission deleted successfully" };
	}

	@Post(":id/restore")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(AdminPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Restored permission" })
	public async restore(@ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionResponse> {
		return toAdminPermissionResponse(await this.authorization.permissions.restore(id));
	}

	@Get("groups/list")
	@RequirePermission("LIST", "PERMISSION")
	@ZodResponse(PermissionGroupsResponseSchema, { description: "List of permission groups" })
	public async listGroups(): Promise<PermissionGroupsResponse> {
		const groups = await this.authorization.permissions.listGroups();
		return { groups };
	}

	@Post("check")
	@RequirePermission("READ", "PERMISSION")
	@ZodResponse(CheckPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Permission check result with grant provenance" })
	public async checkPermission(@ZodBody(CheckPermissionDto.schema) body: CheckPermissionDto): Promise<CheckPermissionResponse> {
		return this.authorization.checkerService.checkPermissionWithGrants(body.userId, body.action, body.resource);
	}

	@Post("user/grant")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Direct permission granted to user" })
	public async grantToUser(@CurrentUser() actor: AuthenticatedUser, @ZodBody(GrantPermissionToUserDto.schema) body: GrantPermissionToUserDto): Promise<RbacMessageResponse> {
		const effect = body.effect ?? "ALLOW";
		this.escalation.assertNotSelf(actor, body.userId);
		// A DENY override only restricts the target; an ALLOW must be a subset of the actor's own grants.
		if (effect === "ALLOW") {
			await this.escalation.assertCanGrantPermissions(actor, [body.permissionId]);
		}
		await this.authorization.permissions.giveToUser(body.userId, body.permissionId, body.expiresAt, actor.id, effect);
		return { message: "Permission granted to user successfully" };
	}

	@Post("user/revoke")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Direct permission revoked from user" })
	public async revokeFromUser(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodBody(GrantPermissionToUserDto.schema) body: GrantPermissionToUserDto,
	): Promise<RbacMessageResponse> {
		// Revoking an override can lift a DENY — treat it like granting.
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantPermissions(actor, [body.permissionId]);
		await this.authorization.permissions.revokeFromUser(body.userId, body.permissionId, actor.id);
		return { message: "Permission revoked from user" };
	}

	@Post("user/sync")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "User permissions synced" })
	public async syncUserPermissions(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodBody(SyncUserPermissionsDto.schema) body: SyncUserPermissionsDto,
	): Promise<RbacMessageResponse> {
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantPermissions(actor, body.permissionIds);
		await this.authorization.permissions.syncUserPermissions(body.userId, body.permissionIds, actor.id);
		return { message: "User permissions synced successfully" };
	}
}
