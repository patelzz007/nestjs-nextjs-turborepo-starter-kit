import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	RbacMessageResponseSchema,
	RoleAssignmentPreviewSchema,
	RoleAssignmentValidationResponseSchema,
	RoleListItemSchema,
	RoleListQuerySchema,
	RoleResponseSchema,
	UuidParamSchema,
	type RbacMessageResponse,
	type RoleAssignmentPreview,
	type RoleAssignmentValidationResponse,
	type PaginatedServiceResult,
	type RoleListItem,
	type RoleListQuery,
	type RoleResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AssignRoleCommand } from "../../application/commands/assign-role/assign-role.command";
import { CreateRoleCommand } from "../../application/commands/create-role/create-role.command";
import { RemoveRoleCommand } from "../../application/commands/remove-role/remove-role.command";
import { RestoreRoleCommand } from "../../application/commands/restore-role/restore-role.command";
import { ReviseRoleCommand } from "../../application/commands/revise-role/revise-role.command";
import { SyncRolePermissionsCommand } from "../../application/commands/sync-role-permissions/sync-role-permissions.command";
import { SyncUserRolesCommand } from "../../application/commands/sync-user-roles/sync-user-roles.command";
import { UnassignRoleCommand } from "../../application/commands/unassign-role/unassign-role.command";
import { GetRoleQuery } from "../../application/queries/get-role/get-role.query";
import { ListRolesQuery } from "../../application/queries/list-roles/list-roles.query";
import { PreviewRoleAssignmentQuery } from "../../application/queries/preview-role-assignment/preview-role-assignment.query";
import { ValidateRoleAssignmentQuery } from "../../application/queries/validate-role-assignment/validate-role-assignment.query";
import { RBAC_CATALOG_READ_OPERATION, RBAC_INSPECT_OPERATION, RBAC_MUTATE_OPERATION } from "../../application/ports/authorization.tokens";
import { SyncRolePermissionsDto } from "./dtos/permission.dto";
import { AssignRoleToUserDto, CreateRoleDto, SyncUserRolesDto, UpdateRoleDto, ValidateRoleAssignmentDto } from "./dtos/role.dto";

/** Role catalog and user → role assignment. Every route makes exactly one bus call. */
@Controller(apiPath("/admin/roles"))
@ApiTags("Roles")
export class RolesController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get()
	@SkipAuthThrottle()
	@RequirePermission("LIST", "ROLE")
	@PlatformOperation(RBAC_CATALOG_READ_OPERATION)
	@ZodPaginatedResponse(RoleListItemSchema, { description: "One page of the roles; pagination is in `meta`" })
	public async list(@CurrentActor() actor: ActorContext, @ZodListQuery(RoleListQuerySchema) query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		return this.queryBus.execute(new ListRolesQuery(actor, query));
	}

	@Post()
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("CREATE", "ROLE", { description: "Create new role" })
	@ZodResponse(RoleResponseSchema, { status: HttpStatus.CREATED, description: "Created role" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async create(@CurrentActor() actor: ActorContext, @ZodBody(CreateRoleDto.schema) body: CreateRoleDto): Promise<RoleResponse> {
		return this.commandBus.execute(new CreateRoleCommand(actor, { name: body.name, description: body.description }));
	}

	// ── User role assignment (action-style) ───────────────────────────────

	@Post("user/assign")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@RequirePermission("UPDATE", "USER", { description: "Assign role to user" })
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role assigned to user" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async assignRoleToUser(@CurrentActor() actor: ActorContext, @ZodBody(AssignRoleToUserDto.schema) body: AssignRoleToUserDto): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new AssignRoleCommand(actor, { userId: body.userId, roleId: body.roleId }));
		return { message: "Role assigned to user successfully" };
	}

	@Post("user/remove")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role removed from user" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async removeRoleFromUser(@CurrentActor() actor: ActorContext, @ZodBody(AssignRoleToUserDto.schema) body: AssignRoleToUserDto): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new UnassignRoleCommand(actor, { userId: body.userId, roleId: body.roleId }));
		return { message: "Role removed from user successfully" };
	}

	@Post("user/sync")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "User roles synced" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async syncUserRoles(@CurrentActor() actor: ActorContext, @ZodBody(SyncUserRolesDto.schema) body: SyncUserRolesDto): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new SyncUserRolesCommand(actor, { userId: body.userId, roleIds: body.roleIds }));
		return { message: "User roles synced successfully" };
	}

	@Get(":id")
	@RequirePermission("READ", "ROLE")
	@PlatformOperation(RBAC_CATALOG_READ_OPERATION)
	@ZodResponse(RoleResponseSchema, { description: "Role detail (404 NOT_FOUND when no live role has that id)" })
	public async detail(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<RoleResponse> {
		return this.queryBus.execute(new GetRoleQuery(actor, id));
	}

	@Patch(":id")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { description: "Updated role" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async update(
		@CurrentActor() actor: ActorContext,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(UpdateRoleDto.schema) body: UpdateRoleDto,
	): Promise<RoleResponse> {
		return this.commandBus.execute(
			new ReviseRoleCommand(actor, id, {
				...(body.name === undefined ? {} : { name: body.name }),
				...(body.description === undefined ? {} : { description: body.description }),
				...(body.isActive === undefined ? {} : { isActive: body.isActive }),
			}),
		);
	}

	@Delete(":id")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("DELETE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { description: "Role deleted" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async remove(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new RemoveRoleCommand(actor, id));
		return { message: "Role deleted successfully" };
	}

	@Post(":id/permissions")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RbacMessageResponseSchema, { status: HttpStatus.CREATED, description: "Role permissions synced" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async syncPermissions(
		@CurrentActor() actor: ActorContext,
		@ZodParam("id", UuidParamSchema) id: string,
		@ZodBody(SyncRolePermissionsDto.schema) body: SyncRolePermissionsDto,
	): Promise<RbacMessageResponse> {
		await this.commandBus.execute(new SyncRolePermissionsCommand(actor, id, body.permissionIds));
		return { message: "Role permissions synced successfully" };
	}

	@Post(":id/restore")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleResponseSchema, { status: HttpStatus.CREATED, description: "Restored role" })
	@PlatformOperation(RBAC_MUTATE_OPERATION)
	public async restore(@CurrentActor() actor: ActorContext, @ZodParam("id", UuidParamSchema) id: string): Promise<RoleResponse> {
		return this.commandBus.execute(new RestoreRoleCommand(actor, id));
	}

	// ── Conflict detection (reads: no state change) ───────────────────────

	@Post(":id/validate-assignment")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "ROLE")
	@ZodResponse(RoleAssignmentValidationResponseSchema, { status: HttpStatus.CREATED, description: "Conflict validation result" })
	@PlatformOperation(RBAC_INSPECT_OPERATION)
	public async validateAssignment(
		@CurrentActor() actor: ActorContext,
		@ZodParam("id", UuidParamSchema) _id: string,
		@ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto,
	): Promise<RoleAssignmentValidationResponse> {
		return this.queryBus.execute(new ValidateRoleAssignmentQuery(actor, { userId: body.userId, roleIds: body.roleIds }));
	}

	@Post("preview")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("READ", "ROLE")
	@ZodResponse(RoleAssignmentPreviewSchema, { status: HttpStatus.CREATED, description: "Preview of what permissions would change" })
	@PlatformOperation(RBAC_INSPECT_OPERATION)
	public async preview(@CurrentActor() actor: ActorContext, @ZodBody(ValidateRoleAssignmentDto.schema) body: ValidateRoleAssignmentDto): Promise<RoleAssignmentPreview> {
		return this.queryBus.execute(new PreviewRoleAssignmentQuery(actor, { userId: body.userId, roleIds: body.roleIds }));
	}
}
