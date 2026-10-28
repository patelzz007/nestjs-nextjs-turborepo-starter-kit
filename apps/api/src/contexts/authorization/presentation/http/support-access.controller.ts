import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MessageResponseSchema,
	SupportAccessGrantDetailListSchema,
	SupportAccessGrantDetailSchema,
	TenantSlugParamSchema,
	type PaginatedServiceResult,
	type SupportAccessGrantDetail,
	type SupportAccessGrantListQuery,
	SupportAccessGrantRequestSchema,
	SupportAccessGrantResponseSchema,
	UuidParamSchema,
	type MessageResponse,
	type SupportAccessGrantRequestInput,
	type SupportAccessGrantResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParam, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListSupportAccessGrantsQuery } from "../../application/queries/list-support-access-grants/list-support-access-grants.query";
import { ListTenantSupportAccessGrantsQuery } from "../../application/queries/list-tenant-support-access-grants/list-tenant-support-access-grants.query";
import { ApproveSupportAccessCommand } from "../../application/commands/approve-support-access/approve-support-access.command";
import { RequestSupportAccessCommand } from "../../application/commands/request-support-access/request-support-access.command";
import { RevokeSupportAccessCommand } from "../../application/commands/revoke-support-access/revoke-support-access.command";
import {
	SUPPORT_ACCESS_ADMIN_READ_OPERATION,
	SUPPORT_ACCESS_APPROVE_OPERATION,
	SUPPORT_ACCESS_GRANT_OPERATION,
	SUPPORT_ACCESS_REVOKE_OPERATION,
	SUPPORT_ACCESS_TENANT_READ_OPERATION,
} from "../../application/ports/authorization.tokens";

@ApiTags("Support Access")
@Controller(apiPath("/support-access"))
export class SupportAccessController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get()
	@SuperAdminOnly()
	@RequirePermission("READ", "USER")
	@PlatformOperation(SUPPORT_ACCESS_ADMIN_READ_OPERATION)
	@ZodPaginatedResponse(SupportAccessGrantDetailSchema, { description: "Support access grants, newest first" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.supportAccess.list.input) query: SupportAccessGrantListQuery,
	): Promise<PaginatedServiceResult<SupportAccessGrantDetail>> {
		return this.queryBus.execute(new ListSupportAccessGrantsQuery(actor, query));
	}

	@Post("request")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "USER", { description: "SuperAdmin can request support access" })
	@ZodResponse(SupportAccessGrantResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant requested" })
	@PlatformOperation(SUPPORT_ACCESS_GRANT_OPERATION)
	public async requestGrant(
		@CurrentActor() actor: ActorContext,
		@ZodBody(SupportAccessGrantRequestSchema) body: SupportAccessGrantRequestInput,
	): Promise<SupportAccessGrantResponse> {
		return this.commandBus.execute(new RequestSupportAccessCommand(actor, body));
	}

	/**
	 * Tenant-side approval. Authorization is resource-scoped, not a platform permission: the caller must be
	 * an active OWNER of the tenant the grant belongs to, read from the grant record (no request
	 * body), and the check runs in the transaction that approves it.
	 */
	@Post(":grantId/approve")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant approved" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Caller is not an active owner of the grant's tenant" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Grant is not pending approval (decided, revoked, expired, or self-requested)" })
	@PlatformOperation(SUPPORT_ACCESS_APPROVE_OPERATION)
	public async approve(@CurrentActor() actor: ActorContext, @ZodParam("grantId", UuidParamSchema) grantId: string): Promise<MessageResponse> {
		await this.commandBus.execute(new ApproveSupportAccessCommand(actor, grantId));
		return { message: "Support access approved" };
	}

	@Post(":grantId/revoke")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "USER", { resourceId: "grantId", description: "SuperAdmin can revoke support access" })
	@ZodResponse(MessageResponseSchema, { status: HttpStatus.CREATED, description: "Support access grant revoked" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Grant is already revoked, expired, or denied" })
	@PlatformOperation(SUPPORT_ACCESS_REVOKE_OPERATION)
	public async revoke(@ZodParam("grantId", UuidParamSchema) grantId: string, @CurrentActor() actor: ActorContext): Promise<MessageResponse> {
		await this.commandBus.execute(new RevokeSupportAccessCommand(actor, grantId));
		return { message: "Support access revoked" };
	}
}

/** The tenant owner's side of support access: their tenant's grants, to approve the pending ones. */
@ApiTags("Support Access")
@Controller(apiPath("/tenants"))
export class TenantSupportAccessController {
	public constructor(private readonly queryBus: QueryBus) {}

	/** Resource-scoped like approval: only an active OWNER of the tenant (checked in the read itself) gets the list. */
	@Get(":tenantSlug/support-access")
	@PlatformOperation(SUPPORT_ACCESS_TENANT_READ_OPERATION)
	@ZodResponse(SupportAccessGrantDetailListSchema, { description: "The tenant's support access grants, newest first" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "No such tenant, or the caller is not its active owner" })
	public async list(@CurrentActor() actor: ActorContext, @ZodParams(TenantSlugParamSchema) params: { tenantSlug: string }): Promise<readonly SupportAccessGrantDetail[]> {
		return this.queryBus.execute(new ListTenantSupportAccessGrantsQuery(actor, params));
	}
}
