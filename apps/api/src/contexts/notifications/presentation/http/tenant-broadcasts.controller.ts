// ============================================
// notifications/presentation/http/tenant-broadcasts.controller.ts — a business writing to its customers (ADR 073)
// ============================================
// Owners and managers: `merchant:manage_broadcasts` to write, `merchant:publish_broadcasts` to schedule and
// cancel (both checked in the service). The audience is everyone the filters match, or people picked by hand.
import { Controller, Get, HttpStatus, Inject, Post, Put, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	BroadcastAudiencePreviewSchema,
	BroadcastDraftSchema,
	BroadcastListQuerySchema,
	BroadcastResponseSchema,
	BroadcastWeeklyAllowanceSchema,
	TenantBroadcastAudienceSchema,
	TenantCustomerEntrySchema,
	TenantCustomerListQuerySchema,
	TenantSlugParamSchema,
	type BroadcastAudiencePreview,
	type BroadcastDraftInput,
	type BroadcastListQuery,
	type BroadcastResponse,
	type BroadcastWeeklyAllowance,
	type PaginatedServiceResult,
	type TenantBroadcastAudience,
	type TenantCustomerEntry,
	type TenantCustomerListQuery,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { BROADCAST_SERVICE } from "../../application/ports/notifications.tokens";
import type { BroadcastService } from "../../application/services/broadcast-service";

const TenantBroadcastParamsSchema = z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, broadcastId: z.uuid() }).strict();
type TenantBroadcastParams = z.output<typeof TenantBroadcastParamsSchema>;

/** A tenant's owners and managers write to their own customers: everyone the filters match, or people they pick. */
@ApiTags("Broadcasts")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/broadcasts"))
export class TenantBroadcastsController {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: BroadcastService) {}

	@Get()
	@ApiOperation({ summary: "The tenant's broadcasts, newest first" })
	@ZodPaginatedResponse(BroadcastResponseSchema, { description: "One page of broadcasts" })
	public list(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(BroadcastListQuerySchema) query: BroadcastListQuery,
	): Promise<PaginatedServiceResult<BroadcastResponse>> {
		return this.broadcasts.list(actor, { kind: "tenant", tenantId: merchant.tenantId }, query);
	}

	@Get("allowance")
	@ApiOperation({ summary: "Broadcasts used this week, the weekly limit, and whether broadcasting is on" })
	@ZodResponse(BroadcastWeeklyAllowanceSchema, { description: "The allowance" })
	public allowance(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
	): Promise<BroadcastWeeklyAllowance> {
		return this.broadcasts.allowance(actor, merchant.tenantId);
	}

	@Get("customers")
	@ApiOperation({ summary: "The tenant's customers, to pick recipients by hand (name and masked email; who can receive)" })
	@ZodPaginatedResponse(TenantCustomerEntrySchema, { description: "One page of customers" })
	public customers(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(TenantCustomerListQuerySchema) query: TenantCustomerListQuery,
	): Promise<PaginatedServiceResult<TenantCustomerEntry>> {
		return this.broadcasts.customers(actor, merchant.tenantId, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("audience-preview")
	@ApiOperation({ summary: "How many customers the audience reaches, and how many it leaves out and why (counts only)" })
	@ZodResponse(BroadcastAudiencePreviewSchema, { status: HttpStatus.CREATED, description: "The count" })
	public preview(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(TenantBroadcastAudienceSchema) audience: TenantBroadcastAudience,
	): Promise<BroadcastAudiencePreview> {
		return this.broadcasts.previewAudience(actor, { kind: "tenant", tenantId: merchant.tenantId }, audience);
	}

	@Get(":broadcastId")
	@ApiOperation({ summary: "One broadcast with its results per channel" })
	@ZodResponse(BroadcastResponseSchema, { description: "The broadcast" })
	public get(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantBroadcastParamsSchema) params: TenantBroadcastParams,
	): Promise<BroadcastResponse> {
		return this.broadcasts.get(actor, { kind: "tenant", tenantId: merchant.tenantId }, params.broadcastId);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Write a broadcast to the tenant's customers (a draft); 400 names any link that may not be sent" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "The draft" })
	public create(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(BroadcastDraftSchema) draft: BroadcastDraftInput,
	): Promise<BroadcastResponse> {
		return this.broadcasts.create(actor, { kind: "tenant", tenantId: merchant.tenantId }, draft);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Put(":broadcastId")
	@ApiOperation({ summary: "Edit a draft; 409 for any other status" })
	@ZodResponse(BroadcastResponseSchema, { description: "The draft" })
	public update(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantBroadcastParamsSchema) params: TenantBroadcastParams,
		@ZodBody(BroadcastDraftSchema) draft: BroadcastDraftInput,
	): Promise<BroadcastResponse> {
		return this.broadcasts.update(actor, { kind: "tenant", tenantId: merchant.tenantId }, params.broadcastId, draft);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":broadcastId/schedule")
	@ApiOperation({ summary: "Schedule a draft; 409 when the weekly allowance is used up or broadcasting is off" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "Scheduled" })
	public schedule(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantBroadcastParamsSchema) params: TenantBroadcastParams,
	): Promise<BroadcastResponse> {
		return this.broadcasts.schedule(actor, { kind: "tenant", tenantId: merchant.tenantId }, params.broadcastId);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":broadcastId/cancel")
	@ApiOperation({ summary: "Cancel before sending; 409 once it is sending or sent" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "Cancelled" })
	public cancel(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantBroadcastParamsSchema) params: TenantBroadcastParams,
	): Promise<BroadcastResponse> {
		return this.broadcasts.cancel(actor, { kind: "tenant", tenantId: merchant.tenantId }, params.broadcastId);
	}
}
