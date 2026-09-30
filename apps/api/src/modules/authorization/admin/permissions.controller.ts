import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Permission } from "@prisma/client";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import { apiPath, type CheckPermissionResponse, type PermissionListItem } from "@workspace/shared";
import { AuthorizationService } from "../services/authorization.service";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Authorize } from "../decorators/authorize.decorator";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { PrivilegeEscalationService } from "../services/privilege-escalation.service";
import { CreatePermissionDto, GrantPermissionToUserDto, SyncUserPermissionsDto, CheckPermissionDto } from "./dtos/permission.dto";

// ── DTOs (only for PATCH — body is optional-field) ───────────────────────────

interface UpdatePermissionBody {
	readonly description?: string;
	readonly group?: string;
	readonly isSystem?: boolean;
}

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
	@ApiOkResponse({ description: "List of permissions" })
	public async list(): Promise<{ readonly items: readonly PermissionListItem[]; readonly total: number }> {
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
	@ApiBody({ type: CreatePermissionDto })
	@ApiOkResponse({ description: "Created permission" })
	public async create(@Body(new ZodValidationPipe(CreatePermissionDto.schema)) body: CreatePermissionDto): Promise<Permission> {
		return this.authorization.permissions.create({
			action: body.action,
			resource: body.resource,
			description: body.description,
			group: body.group,
			isSystem: body.isSystem,
		});
	}

	@Get(":id")
	@RequirePermission("READ", "PERMISSION")
	@ApiOkResponse({ description: "Permission detail" })
	public async detail(@Param("id") id: string): Promise<Permission | null> {
		return this.authorization.permissions.findById(id);
	}

	@Patch(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@Authorize({ action: "UPDATE", resource: "PERMISSION", resourceId: "id", description: "Update permission" })
	@ApiOkResponse({ description: "Updated permission" })
	public async update(@Param("id") id: string, @Body() body: UpdatePermissionBody): Promise<Permission> {
		return this.authorization.permissions.update(id, {
			...(body.description !== undefined ? { description: body.description } : {}),
			...(body.group !== undefined ? { group: body.group } : {}),
			...(body.isSystem !== undefined ? { isSystem: body.isSystem } : {}),
		});
	}

	@Delete(":id")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("DELETE", "PERMISSION")
	@ApiOkResponse({ description: "Permission deleted" })
	public async remove(@Param("id") id: string): Promise<{ readonly message: string }> {
		await this.authorization.permissions.remove(id);
		return { message: "Permission deleted successfully" };
	}

	@Post(":id/restore")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ApiOkResponse({ description: "Restored permission" })
	public async restore(@Param("id") id: string): Promise<Permission> {
		return this.authorization.permissions.restore(id);
	}

	@Get("groups/list")
	@RequirePermission("LIST", "PERMISSION")
	@ApiOkResponse({ description: "List of permission groups" })
	public async listGroups(): Promise<{ readonly groups: readonly string[] }> {
		const groups = await this.authorization.permissions.listGroups();
		return { groups };
	}

	@Post("check")
	@RequirePermission("READ", "PERMISSION")
	@ApiBody({ type: CheckPermissionDto })
	@ApiOkResponse({ description: "Permission check result with grant provenance" })
	public async checkPermission(@Body(new ZodValidationPipe(CheckPermissionDto.schema)) body: CheckPermissionDto): Promise<CheckPermissionResponse> {
		return this.authorization.checkerService.checkPermissionWithGrants(body.userId, body.action, body.resource);
	}

	@Post("user/grant")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ApiBody({ type: GrantPermissionToUserDto })
	@ApiOkResponse({ description: "Direct permission granted to user" })
	public async grantToUser(
		@CurrentUser() actor: AuthenticatedUser,
		@Body(new ZodValidationPipe(GrantPermissionToUserDto.schema)) body: GrantPermissionToUserDto,
	): Promise<{ readonly message: string }> {
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
	@ApiBody({ type: GrantPermissionToUserDto })
	@ApiOkResponse({ description: "Direct permission revoked from user" })
	public async revokeFromUser(
		@CurrentUser() actor: AuthenticatedUser,
		@Body(new ZodValidationPipe(GrantPermissionToUserDto.schema)) body: GrantPermissionToUserDto,
	): Promise<{ readonly message: string }> {
		// Revoking an override can lift a DENY — treat it like granting.
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantPermissions(actor, [body.permissionId]);
		await this.authorization.permissions.revokeFromUser(body.userId, body.permissionId, actor.id);
		return { message: "Permission revoked from user" };
	}

	@Post("user/sync")
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@RequirePermission("UPDATE", "PERMISSION")
	@ApiBody({ type: SyncUserPermissionsDto })
	@ApiOkResponse({ description: "User permissions synced" })
	public async syncUserPermissions(
		@CurrentUser() actor: AuthenticatedUser,
		@Body(new ZodValidationPipe(SyncUserPermissionsDto.schema)) body: SyncUserPermissionsDto,
	): Promise<{ readonly message: string }> {
		this.escalation.assertNotSelf(actor, body.userId);
		await this.escalation.assertCanGrantPermissions(actor, body.permissionIds);
		await this.authorization.permissions.syncUserPermissions(body.userId, body.permissionIds, actor.id);
		return { message: "User permissions synced successfully" };
	}
}
