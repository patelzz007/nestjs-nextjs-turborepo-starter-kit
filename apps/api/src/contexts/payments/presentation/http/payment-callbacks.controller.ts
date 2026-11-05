// ============================================
// payments/presentation/http/payment-callbacks.controller.ts — the gateways tell the platform (ADR 020)
// ============================================
// Public (gateways can't sign in), signature-verified over the RAW body through the shared inbound path
// (ADR 081): an unsigned or forged callback answers 401 and changes nothing; every request is logged in the
// received-webhook log. A verified one answers 200 even for a payment the platform doesn't know, so the
// gateway stops retrying it (the service logs it); a redelivery answers 200 without being applied again.
import { Controller, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, PaymentCallbackResponseSchema, type PaymentCallbackResponse, type PaymentProviderName } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { inboundWebhookRequest } from "../../../webhooks/inbound/public-api";
import { PAYMENT_CALLBACK_OPERATION, PAYMENT_CALLBACK_RECEPTION } from "../../application/payments.tokens";
import type { PaymentCallbackReception } from "../../application/services/payment-callback-reception";

const RECEIVED: PaymentCallbackResponse = { received: true };

@ApiTags("Payments")
@Controller(apiPath("/payments/callbacks"))
export class PaymentCallbacksController {
	public constructor(@Inject(PAYMENT_CALLBACK_RECEPTION) private readonly reception: Pick<PaymentCallbackReception, "receive">) {}

	@Public()
	@PublicOperation(PAYMENT_CALLBACK_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("billplz")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Billplz's bill callback (form-encoded, x_signature verified)" })
	@ZodResponse(PaymentCallbackResponseSchema, { description: "Received" })
	public billplz(@Req() request: RawBodyRequest<FastifyRequest>, @CurrentActor({ allowAnonymous: true }) actor: ActorContext): Promise<PaymentCallbackResponse> {
		return this.receive("BILLPLZ", request, actor);
	}

	@Public()
	@PublicOperation(PAYMENT_CALLBACK_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("chip")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "CHIP's purchase callback (JSON, X-Signature verified with the company public key)" })
	@ZodResponse(PaymentCallbackResponseSchema, { description: "Received" })
	public chip(@Req() request: RawBodyRequest<FastifyRequest>, @CurrentActor({ allowAnonymous: true }) actor: ActorContext): Promise<PaymentCallbackResponse> {
		return this.receive("CHIP", request, actor);
	}

	@Public()
	@PublicOperation(PAYMENT_CALLBACK_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("fake")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "The fake gateway's callback (development and tests only; refused where it isn't configured)" })
	@ZodResponse(PaymentCallbackResponseSchema, { description: "Received" })
	public fake(@Req() request: RawBodyRequest<FastifyRequest>, @CurrentActor({ allowAnonymous: true }) actor: ActorContext): Promise<PaymentCallbackResponse> {
		return this.receive("FAKE", request, actor);
	}

	private async receive(provider: PaymentProviderName, request: RawBodyRequest<FastifyRequest>, actor: ActorContext): Promise<PaymentCallbackResponse> {
		await this.reception.receive(actor, provider, inboundWebhookRequest(request.rawBody, request.headers));
		return RECEIVED;
	}
}
