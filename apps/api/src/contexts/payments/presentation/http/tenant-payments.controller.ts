// ============================================
// payments/presentation/http/tenant-payments.controller.ts — a business takes payments (ADR 020)
// ============================================
// Owners and managers (`merchant:manage_payments`, checked in the service): ask for a payment through a
// configured gateway (Billplz, CHIP), send the payer to its checkout, follow it, refund it (CHIP).
import { Controller, Get, HttpStatus, Inject, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CreatePaymentIntentSchema,
	PaymentIntentIdParamsSchema,
	PaymentIntentListQuerySchema,
	PaymentIntentResponseSchema,
	PaymentProvidersResponseSchema,
	PaymentRefundResponseSchema,
	TenantSlugParamSchema,
	type CreatePaymentIntent,
	type PaginatedServiceResult,
	type PaymentIntentListQuery,
	type PaymentIntentResponse,
	type PaymentProvidersResponse,
	type PaymentRefundResponse,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { IdempotencyKeyHeader } from "../../../../platform/presentation/http/idempotency/idempotency-key.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { PAYMENTS_SERVICE } from "../../application/payments.tokens";
import type { PaymentsService } from "../../application/services/payments.service";

const TenantPaymentParamsSchema = z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, paymentId: PaymentIntentIdParamsSchema.shape.paymentId }).strict();
type TenantPaymentParams = z.output<typeof TenantPaymentParamsSchema>;

@ApiTags("Payments")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/payments"))
export class TenantPaymentsController {
	public constructor(@Inject(PAYMENTS_SERVICE) private readonly payments: PaymentsService) {}

	@Get()
	@ApiOperation({ summary: "The tenant's payments, newest first" })
	@ZodPaginatedResponse(PaymentIntentResponseSchema, { description: "One page of payments" })
	public list(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(PaymentIntentListQuerySchema) query: PaymentIntentListQuery,
	): Promise<PaginatedServiceResult<PaymentIntentResponse>> {
		return this.payments.list(actor, merchant.tenantId, query);
	}

	@Post()
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Idempotent({ required: true })
	@ApiOperation({ summary: "Ask for a payment: opens a checkout at the gateway (the same Idempotency-Key returns the same payment, never a second one)" })
	@ZodResponse(PaymentIntentResponseSchema, { status: HttpStatus.CREATED, description: "The payment, with the checkout to send the payer to" })
	public create(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@IdempotencyKeyHeader() idempotencyKey: string,
		@ZodBody(CreatePaymentIntentSchema) body: CreatePaymentIntent,
	): Promise<PaymentIntentResponse> {
		return this.payments.create(actor, merchant.tenantId, idempotencyKey, body);
	}

	// Declared before `:paymentId`, so "providers" is never read as a payment id.
	@Get("providers")
	@ApiOperation({ summary: "The gateways this deployment can take payments through, and whether each refunds through its API" })
	@ZodResponse(PaymentProvidersResponseSchema, { description: "The configured gateways" })
	public providers(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
	): Promise<PaymentProvidersResponse> {
		return this.payments.availableProviders(actor, merchant.tenantId);
	}

	@Get(":paymentId")
	@ApiOperation({ summary: "One payment" })
	@ZodResponse(PaymentIntentResponseSchema, { description: "The payment" })
	public get(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantPaymentParamsSchema) params: TenantPaymentParams,
	): Promise<PaymentIntentResponse> {
		return this.payments.get(actor, merchant.tenantId, params.paymentId);
	}

	@Post(":paymentId/refund")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Refund a paid payment in full through its gateway (CHIP; Billplz refunds in its own dashboard)" })
	@ZodResponse(PaymentRefundResponseSchema, { description: "Refunded, or pending at the gateway" })
	public refund(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantPaymentParamsSchema) params: TenantPaymentParams,
	): Promise<PaymentRefundResponse> {
		return this.payments.refund(actor, merchant.tenantId, params.paymentId);
	}
}
