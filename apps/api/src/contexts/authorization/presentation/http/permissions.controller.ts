import { Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	AdminPermissionResponseSchema,
	CheckPermissionResponseSchema,
	PermissionGroupsResponseSchema,
	PermissionListItemSchema,
	PermissionListQuerySchema,
	RbacMessageResponseSchema,
	UuidParamSchema,
	type AdminPermissionResponse,
	type CheckPermissionResponse,
	type PermissionGroupsResponse,
	type PaginatedServiceResult,
	type PermissionListItem,
	type PermissionListQuery,
	type RbacMessageResponse,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CreatePermissionCommand } from "../../application/commands/create-permission/create-permission.command";
import { GrantUserPermissionCommand } from "../../application/commands/grant-user-permission/grant-user-permission.command";
import { RemovePermissionCommand } from "../../application/commands/remove-permission/remove-permission.command";
import { RestorePermissionCommand } from "../../application/commands/restore-permission/restore-permission.command";
import { RevisePermissionCommand } from "../../application/commands/revise-permission/revise-permission.command";
import { RevokeUserPermissionCommand } from "../../application/commands/revoke-user-permission/revoke-user-permission.command";
import { SyncUserPermissionsCommand } from "../../application/commands/sync-user-permissions/sync-user-permissions.command";
import { RBAC_CATALOG_READ_OPERATION, RBAC_MUTATE_OPERATION } from "../../application/ports/authorization.tokens";
import { PermissionCheckApplicationService } from "../../application/services/permission-check.application-service";
import { RbacCatalogApplicationService } from "../../application/services/rbac-catalog.application-service";
import { CheckPermissionDto, CreatePermissionDto, GrantPermissionToUserDto, SyncUserPermissionsDto, UpdatePermissionDto } from "./dtos/permission.dto";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/** Permission catalog and direct user grants. Every route makes exactly one call: a command, or a read of an application service. */
@ApiController("/admin/permissions")
@ApiTags("Permissions")
export class PermissionsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly catalog: RbacCatalogApplicationService,
		private readonly permissionCheck: PermissionCheckApplicationService,
	) {}

	@Get()
	@SkipAuthThrottle()
	@RequirePermission("LIST", "PERMISSION")
	@PlatformOperation(RBAC_CATALOG_READ_OPERATION)
	@ZodPaginatedResponse(PermissionListItemSchema, { description: "One page of the permissions; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(PermissionListQuerySchema) query: PermissionListQuery,
	): Promise<PaginatedServiceResult<PermissionListItem>> {
		return this.catalog.listPermissions(actor, query);
	}

	@Post()
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("CREATE", "PERMISSION", { description: "Create new permission" })
	@ZodResponse(AdminPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Created permission" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async create(@CurrentActor() actor: ActorContext, @ZodBody(CreatePermissionDto.schema) body: CreatePermissionDto): Promise<AdminPermissionResponse> {
		return this.commandBus.execute(new CreatePermissionCommand(actor, { action: body.action, resource: body.resource, description: body.description, group: body.group }));
	}

	@Get(":id")
	@RequirePermission("READ", "PERMISSION")
	@PlatformOperation(RBAC_CATALOG_READ_OPERATION)
	@ZodResponse(AdminPermissionResponseSchema, { description: "Permission detail (404 NOT_FOUND when no live permission has that id)" })
	public async detail(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionResponse> {
		return this.catalog.getPermission(actor, id);
	}

	@Patch(":id")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "PERMISSION")
	@RequirePermission("UPDATE", "PERMISSION", { resourceId: "id", description: "Update permission" })
	@ZodResponse(AdminPermissionResponseSchema, { description: "Updated permission" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async update(
		@CurrentActor() actor: ActorContext,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(UpdatePermissionDto.schema) body: UpdatePermissionDto,
	): Promise<AdminPermissionResponse> {
		return this.commandBus.execute(
			new RevisePermissionCommand(actor, id, {
				...(body.description === undefined ? {} : { description: body.description }),
				...(body.group === undefined ? {} : { group: body.group }),
			}),
		);
	}

	@Delete(":id")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("DELETE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { description: "Permission deleted" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async remove(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new RemovePermissionCommand(actor, id));
		return { message: "Permission deleted successfully" };
	}

	@Post(":id/restore")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(AdminPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Restored permission" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async restore(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<AdminPermissionResponse> {
		return this.commandBus.execute(new RestorePermissionCommand(actor, id));
	}

	@Get("groups/list")
	@RequirePermission("LIST", "PERMISSION")
	@PlatformOperation(RBAC_CATALOG_READ_OPERATION)
	@ZodResponse(PermissionGroupsResponseSchema, { description: "List of permission groups" })
	public async listGroups(@CurrentActor() actor: ActorContext): Promise<PermissionGroupsResponse> {
		return this.catalog.listPermissionGroups(actor);
	}

	/** A read (no state change): limited like any authenticated POST, not as a security mutation. */
	@Post("check")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("READ", "PERMISSION")
	@PlatformOperation(PRINCIPAL_LOOKUP_OPERATION)
	@ZodResponse(CheckPermissionResponseSchema, { status: HttpStatus.CREATED, description: "Permission check result with grant provenance" })
	public async checkPermission(@ZodBody(CheckPermissionDto.schema) body: CheckPermissionDto): Promise<CheckPermissionResponse> {
		return this.permissionCheck.check({ userId: body.userId, action: body.action, resource: body.resource });
	}

	@Post("user/grant")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Direct permission granted to user" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async grantToUser(@CurrentActor() actor: ActorContext, @ZodBody(GrantPermissionToUserDto.schema) body: GrantPermissionToUserDto): Promise<RbacMessageResponse> {
		// Escalation checks (self, SuperAdmin target, subset rule for ALLOW and DENY) run inside the command's transaction.
		await this.commandBus.execute(
			new GrantUserPermissionCommand(actor, { userId: body.userId, permissionId: body.permissionId, effect: body.effect ?? "ALLOW", expiresAt: body.expiresAt }),
		);
		return { message: "Permission granted to user successfully" };
	}

	@Post("user/revoke")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Direct permission revoked from user" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async revokeFromUser(@CurrentActor() actor: ActorContext, @ZodBody(GrantPermissionToUserDto.schema) body: GrantPermissionToUserDto): Promise<RbacMessageResponse> {
		// Revoking an override can lift a DENY: the command treats it like granting.
		await this.commandBus.execute(new RevokeUserPermissionCommand(actor, { userId: body.userId, permissionId: body.permissionId }));
		return { message: "Permission revoked from user" };
	}

	@Post("user/sync")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "PERMISSION")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "User permissions synced" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async syncUserPermissions(@CurrentActor() actor: ActorContext, @ZodBody(SyncUserPermissionsDto.schema) body: SyncUserPermissionsDto): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new SyncUserPermissionsCommand(actor, { userId: body.userId, permissionIds: body.permissionIds }));
		return { message: "User permissions synced successfully" };
	}
}
