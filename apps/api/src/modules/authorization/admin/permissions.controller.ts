import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import {
	AdminPermissionResponseSchema,
	apiPath,
	CheckPermissionResponseSchema,
	PermissionGroupsResponseSchema,
	PermissionListResponseSchema,
	RbacMessageResponseSchema,
	UuidParamSchema,
	type AdminPermissionResponse,
	type CheckPermissionResponse,
	type PermissionGroupsResponse,
	type PermissionListItem,
	type PermissionListResponse,
	type RbacMessageResponse,
} from "@workspace/shared";
import { AuthorizationCheckerService } from "../services/authorization-checker.service";
import { PermissionService } from "../services/permission.service";
import { ZodBody, ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import { Authorize } from "../decorators/authorize.decorator";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { CreatePermissionDto, GrantPermissionToUserDto, SyncUserPermissionsDto, CheckPermissionDto, UpdatePermissionDto } from "./dtos/permission.dto";
import { toAdminPermissionResponse } from "./mappers/rbac-response.mappers";

// ── Controller ───────────────────────────────────────────────────────────────

@Controller(apiPath("/admin/permissions"))
@ApiTags("Permissions")
export class PermissionsController {
	public constructor(
		private readonly permissions: PermissionService,
		private readonly checker: AuthorizationCheckerService,
	) {}

	@Get()
	@SkipAuthThrottle()
	@RequirePermission("LIST", "PERMISSION")
	@ZodResponse(PermissionListResponseSchema, { description: "List of permissions" })
	public async list(): Promise<PermissionListResponse> {
		const { items } = await this.permissions.findAll({ limit: 500 });
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
	public async create(@CurrentUser() actor: AuthenticatedUser, @ZodBody(CreatePermissionDto.schema) body: CreatePermissionDto): Promise<AdminPermissionResponse> {
		const permission = await this.permissions.create(actor, {
			action: body.action,
			resource: body.resource,
			description: body.description,
			group: body.group,
		});
		return toAdminPermissionResponse(permission);
	}

	@Get(":id")
	@RequirePermission("READ", "PERMISSION")
	@ZodResponse(AdminPermissionResponseSchema, { description: "Permission detail (404 NOT_FOUND when no live permission has that id)" })
	public async detail(@ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionResponse> {
		const permission = await this.permissions.findById(id);
		if (permission === null) {
			throw new ResourceNotFoundError(id);
		}
		return toAdminPermissionResponse(permission);
	}

	@Patch(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@Authorize({ action: "UPDATE", resource: "PERMISSION", resourceId: "id", description: "Update permission" })
	@ZodResponse(AdminPermissionResponseSchema, { description: "Updated permission" })
	public async update(
		@CurrentUser() actor: AuthenticatedUser,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(UpdatePermissionDto.schema) body: UpdatePermissionDto,
	): Promise<AdminPermissionResponse> {
		const permission = await this.permissions.update(actor, id, {
			...(body.description !== undefined ? { description: body.description } : {}),
			...(body.group !== undefined ? { group: body.group } : {}),
		});
		return toAdminPermissionResponse(permission);
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { description: "Permission deleted" })
	public async remove(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.permissions.remove(actor, id);
		return { message: "Permission deleted successfully" };
	}

	@Post(":id/restore")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(AdminPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Restored permission" })
	public async restore(@CurrentUser() actor: AuthenticatedUser, @ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionResponse> {
		return toAdminPermissionResponse(await this.permissions.restore(actor, id));
	}

	@Get("groups/list")
	@RequirePermission("LIST", "PERMISSION")
	@ZodResponse(PermissionGroupsResponseSchema, { description: "List of permission groups" })
	public async listGroups(): Promise<PermissionGroupsResponse> {
		const groups = await this.permissions.listGroups();
		return { groups };
	}

	@Post("check")
	@RequirePermission("READ", "PERMISSION")
	@ZodResponse(CheckPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Permission check result with grant provenance" })
	public async checkPermission(@ZodBody(CheckPermissionDto.schema) body: CheckPermissionDto): Promise<CheckPermissionResponse> {
		return this.checker.checkPermissionWithGrants(body.userId, body.action, body.resource);
	}

	@Post("user/grant")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Direct permission granted to user" })
	public async grantToUser(@CurrentUser() actor: AuthenticatedUser, @ZodBody(GrantPermissionToUserDto.schema) body: GrantPermissionToUserDto): Promise<RbacMessageResponse> {
		// Escalation checks (self, SuperAdmin target, subset rule for ALLOW and DENY) run inside the service's transaction.
		await this.permissions.giveToUser(actor, {
			userId: body.userId,
			permissionId: body.permissionId,
			effect: body.effect ?? "ALLOW",
			expiresAt: body.expiresAt,
		});
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
		// Revoking an override can lift a DENY — the service treats it like granting.
		await this.permissions.revokeFromUser(actor, body.userId, body.permissionId);
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
		await this.permissions.syncUserPermissions(actor, body.userId, body.permissionIds);
		return { message: "User permissions synced successfully" };
	}
}
