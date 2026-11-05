// API contract leaves owned by the `payments` context (ADR 020). Composed into `apiContract`
// (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { TenantSlugParamSchema } from "../tenancy/schemas/tenant";
import { tenantPaymentsRoutes } from "./routes";
import {
	CreatePaymentIntentSchema,
	PaymentIntentIdParamsSchema,
	PaymentIntentListQuerySchema,
	PaymentIntentResponseSchema,
	PaymentProvidersResponseSchema,
	PaymentRefundResponseSchema,
} from "./schemas/payment-intents";

/** A tenant's payments. `createPayment` needs an `Idempotency-Key` header (send it in the call's options). */
export const tenantPaymentsContract = {
	payments: defineContract({
		method: "GET",
		path: tenantPaymentsRoutes.payments,
		input: z.intersection(TenantSlugParamSchema, PaymentIntentListQuerySchema),
		response: paginatedResponse(PaymentIntentResponseSchema),
	}),
	providers: defineContract({
		method: "GET",
		path: tenantPaymentsRoutes.providers,
		input: TenantSlugParamSchema,
		response: singleResponse(PaymentProvidersResponseSchema),
	}),
	payment: defineContract({
		method: "GET",
		path: tenantPaymentsRoutes.payment,
		input: z.intersection(TenantSlugParamSchema, PaymentIntentIdParamsSchema),
		response: singleResponse(PaymentIntentResponseSchema),
	}),
	createPayment: defineContract({
		method: "POST",
		path: tenantPaymentsRoutes.payments,
		input: z.intersection(TenantSlugParamSchema, CreatePaymentIntentSchema),
		response: singleResponse(PaymentIntentResponseSchema),
	}),
	refundPayment: defineContract({
		method: "POST",
		path: tenantPaymentsRoutes.refundPayment,
		input: z.intersection(TenantSlugParamSchema, PaymentIntentIdParamsSchema),
		response: singleResponse(PaymentRefundResponseSchema),
	}),
};
