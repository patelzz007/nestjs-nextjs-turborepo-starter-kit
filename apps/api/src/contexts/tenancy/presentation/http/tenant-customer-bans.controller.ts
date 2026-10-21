import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	OkResponseSchema,
	TenantCustomerBanCreateSchema,
	TenantCustomerBanListQuerySchema,
	TenantCustomerBanParamSchema,
	TenantCustomerBanResponseSchema,
	TenantSlugParamSchema,
	type OkResponse,
	type PaginatedServiceResult,
	type TenantCustomerBanCreateInput,
	type TenantCustomerBanListQuery,
	type TenantCustomerBanParam,
	type TenantCustomerBanResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { BanCustomerCommand } from "../../application/commands/ban-customer/ban-customer.command";
import { LiftCustomerBanCommand } from "../../application/commands/lift-customer-ban/lift-customer-ban.command";
import { ListCustomerBansQuery } from "../../application/queries/list-customer-bans/list-customer-bans.query";

/**
 * A merchant's bans of its customers (`merchant:manage_rewards`): a banned customer cannot claim the
 * merchant's rewards and its tills refuse the customer's codes. A ban is made from one of the
 * tenant's redemptions; merchants never learn who the customer is.
 */
@ApiTags("Tenant Customer Bans")
@Controller(apiPath("/tenants"))
export class TenantCustomerBansController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get(":tenantSlug/customer-bans")
	@ApiOperation({ summary: "List the tenant's active customer bans, newest first" })
	@ZodPaginatedResponse(TenantCustomerBanResponseSchema, { description: "One page of active customer bans; pagination is in `meta`" })
	public list(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodListQuery(TenantCustomerBanListQuerySchema) query: TenantCustomerBanListQuery,
	): Promise<PaginatedServiceResult<TenantCustomerBanResponse>> {
		return this.queryBus.execute(new ListCustomerBansQuery(actor, { tenantSlug: params.tenantSlug, query }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/customer-bans")
	@ApiOperation({
		summary: "Ban the customer behind one of the tenant's redemptions",
		description:
			"404 TENANT_REDEMPTION_NOT_FOUND for a redemption outside the caller's stores; 409 TENANT_CUSTOMER_ALREADY_BANNED when the customer already has an active ban.",
	})
	@ZodResponse(TenantCustomerBanResponseSchema, { status: HttpStatus.CREATED, description: "Customer banned" })
	public ban(
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) params: { tenantSlug: string },
		@ZodBody(TenantCustomerBanCreateSchema) body: TenantCustomerBanCreateInput,
	): Promise<TenantCustomerBanResponse> {
		return this.commandBus.execute(new BanCustomerCommand(actor, { tenantSlug: params.tenantSlug, redemptionId: body.redemptionId, reason: body.reason }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/customer-bans/:banId/lift")
	@ApiOperation({ summary: "Lift a customer ban: the customer may claim and redeem again" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Ban lifted" })
	public async lift(@CurrentActor() actor: ActorContext, @ZodParams(TenantCustomerBanParamSchema) params: TenantCustomerBanParam): Promise<OkResponse> {
		await this.commandBus.execute(new LiftCustomerBanCommand(actor, params));
		return { ok: true };
	}
}
