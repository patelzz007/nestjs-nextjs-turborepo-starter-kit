import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	CreateWebhookEndpointSchema,
	DeleteSuccessDataSchema,
	RotateWebhookSecretSchema,
	TenantSlugParamSchema,
	UpdateWebhookEndpointSchema,
	WebhookDeliveryListQuerySchema,
	WebhookDeliverySummarySchema,
	WebhookEndpointListQuerySchema,
	WebhookEndpointSummarySchema,
	WebhookEndpointWithSecretSchema,
	type DeleteSuccessData,
	type PaginatedServiceResult,
	type WebhookDeliverySummary,
	type WebhookEndpointSummary,
	type WebhookEndpointWithSecret,
} from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CreateWebhookEndpointCommand } from "../../application/commands/create-webhook-endpoint/create-webhook-endpoint.command";
import { DeleteWebhookEndpointCommand } from "../../application/commands/delete-webhook-endpoint/delete-webhook-endpoint.command";
import { DisableWebhookEndpointCommand } from "../../application/commands/disable-webhook-endpoint/disable-webhook-endpoint.command";
import { EnableWebhookEndpointCommand } from "../../application/commands/enable-webhook-endpoint/enable-webhook-endpoint.command";
import { RedeliverWebhookCommand } from "../../application/commands/redeliver-webhook/redeliver-webhook.command";
import { RotateWebhookSecretCommand } from "../../application/commands/rotate-webhook-secret/rotate-webhook-secret.command";
import { SendWebhookTestCommand } from "../../application/commands/send-webhook-test/send-webhook-test.command";
import { UpdateWebhookEndpointCommand } from "../../application/commands/update-webhook-endpoint/update-webhook-endpoint.command";
import { GetWebhookEndpointQuery } from "../../application/queries/get-webhook-endpoint/get-webhook-endpoint.query";
import { ListWebhookDeliveriesQuery } from "../../application/queries/list-webhook-deliveries/list-webhook-deliveries.query";
import { ListWebhookEndpointsQuery } from "../../application/queries/list-webhook-endpoints/list-webhook-endpoints.query";

/** POST bodies with no fields (enable, disable, test, redeliver): documents the optional empty body. */
class WebhooksEmptyBodyDto extends createZodDto(z.object({}).strict()) {}

const EndpointParams = apiContract.tenantWebhooks.endpoint.input;
type EndpointParams = z.output<typeof EndpointParams>;
const DeliveryParams = apiContract.tenantWebhooks.redeliver.input;
type DeliveryParams = z.output<typeof DeliveryParams>;

/**
 * A tenant's outgoing webhooks (ADR 082): its endpoints and the delivery log. Members holding
 * `merchant:manage_webhooks` only (checked by every handler; API keys are refused): the tenant comes from
 * `:tenantSlug` through the membership.
 */
@ApiTags("Tenant Webhooks")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants"))
export class TenantWebhooksController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get(":tenantSlug/webhooks/endpoints")
	@ApiOperation({ summary: "List the tenant's webhook endpoints" })
	@ZodPaginatedResponse(WebhookEndpointSummarySchema, { description: "The tenant's endpoints (at most ten)" })
	public listEndpoints(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(WebhookEndpointListQuerySchema) query: z.output<typeof WebhookEndpointListQuerySchema>,
	): Promise<PaginatedServiceResult<WebhookEndpointSummary>> {
		return this.queryBus.execute(new ListWebhookEndpointsQuery(actor, merchant.tenantId, query));
	}

	@SkipAuthThrottle()
	@Get(":tenantSlug/webhooks/endpoints/:endpointId")
	@ApiOperation({ summary: "Get one webhook endpoint" })
	@ZodResponse(WebhookEndpointSummarySchema, { description: "The endpoint" })
	public getEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
	): Promise<WebhookEndpointSummary> {
		return this.queryBus.execute(new GetWebhookEndpointQuery(actor, merchant.tenantId, params.endpointId));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/endpoints")
	@ApiOperation({ summary: "Register a webhook endpoint (its signing secret is answered once)" })
	@ZodResponse(WebhookEndpointWithSecretSchema, { status: HttpStatus.CREATED, description: "Endpoint registered, with its secret" })
	public createEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(CreateWebhookEndpointSchema) body: z.output<typeof CreateWebhookEndpointSchema>,
	): Promise<WebhookEndpointWithSecret> {
		return this.commandBus.execute(new CreateWebhookEndpointCommand(actor, { ...body, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":tenantSlug/webhooks/endpoints/:endpointId")
	@ApiOperation({ summary: "Change a webhook endpoint's address, description or event types" })
	@ZodResponse(WebhookEndpointSummarySchema, { description: "The changed endpoint" })
	public updateEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
		@ZodBody(UpdateWebhookEndpointSchema) body: z.output<typeof UpdateWebhookEndpointSchema>,
	): Promise<WebhookEndpointSummary> {
		return this.commandBus.execute(new UpdateWebhookEndpointCommand(actor, { ...body, endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Delete(":tenantSlug/webhooks/endpoints/:endpointId")
	@ApiOperation({ summary: "Remove a webhook endpoint (its deliveries stay in the log)" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Endpoint removed" })
	public deleteEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
	): Promise<DeleteSuccessData> {
		return this.commandBus.execute(new DeleteWebhookEndpointCommand(actor, { endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/endpoints/:endpointId/enable")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Switch a webhook endpoint on (no body required)" })
	@ApiBody({ type: WebhooksEmptyBodyDto, required: false })
	@ZodResponse(WebhookEndpointSummarySchema, { description: "The endpoint, switched on" })
	public enableEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
	): Promise<WebhookEndpointSummary> {
		return this.commandBus.execute(new EnableWebhookEndpointCommand(actor, { endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/endpoints/:endpointId/disable")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Switch a webhook endpoint off (no body required)" })
	@ApiBody({ type: WebhooksEmptyBodyDto, required: false })
	@ZodResponse(WebhookEndpointSummarySchema, { description: "The endpoint, switched off" })
	public disableEndpoint(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
	): Promise<WebhookEndpointSummary> {
		return this.commandBus.execute(new DisableWebhookEndpointCommand(actor, { endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/endpoints/:endpointId/rotate-secret")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Replace a webhook endpoint's signing secret (the new one is answered once)" })
	@ZodResponse(WebhookEndpointWithSecretSchema, { description: "The endpoint, with its new secret" })
	public rotateSecret(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
		@ZodBody(RotateWebhookSecretSchema) body: z.output<typeof RotateWebhookSecretSchema>,
	): Promise<WebhookEndpointWithSecret> {
		return this.commandBus.execute(new RotateWebhookSecretCommand(actor, { ...body, endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/endpoints/:endpointId/test")
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({ summary: "Send a webhook endpoint a test event (no body required)" })
	@ApiBody({ type: WebhooksEmptyBodyDto, required: false })
	@ZodResponse(WebhookDeliverySummarySchema, { status: HttpStatus.ACCEPTED, description: "The queued test delivery" })
	public sendTest(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(EndpointParams) params: EndpointParams,
	): Promise<WebhookDeliverySummary> {
		return this.commandBus.execute(new SendWebhookTestCommand(actor, { endpointId: params.endpointId, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get(":tenantSlug/webhooks/deliveries")
	@ApiOperation({ summary: "The delivery log, newest first" })
	@ZodPaginatedResponse(WebhookDeliverySummarySchema, { description: "Deliveries; pagination is in `meta`" })
	public listDeliveries(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(WebhookDeliveryListQuerySchema) query: z.output<typeof WebhookDeliveryListQuerySchema>,
	): Promise<PaginatedServiceResult<WebhookDeliverySummary>> {
		return this.queryBus.execute(new ListWebhookDeliveriesQuery(actor, merchant.tenantId, query));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":tenantSlug/webhooks/deliveries/:deliveryId/redeliver")
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({ summary: "Send a settled delivery again (no body required)" })
	@ApiBody({ type: WebhooksEmptyBodyDto, required: false })
	@ZodResponse(WebhookDeliverySummarySchema, { status: HttpStatus.ACCEPTED, description: "The queued delivery" })
	public redeliver(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(DeliveryParams) params: DeliveryParams,
	): Promise<WebhookDeliverySummary> {
		return this.commandBus.execute(new RedeliverWebhookCommand(actor, { deliveryId: params.deliveryId, tenantId: merchant.tenantId }));
	}
}
