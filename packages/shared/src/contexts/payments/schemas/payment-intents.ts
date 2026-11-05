import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { PAYMENT_DESCRIPTION_MAX_LENGTH, PaymentAmountMinorSchema, PaymentCurrencySchema, PaymentProviderNameSchema, PaymentStatusSchema } from "./payments";

// The payments API contract (ADR 020, phase B): a tenant's owners and managers ask for a payment, send the
// payer to the gateway's checkout, and follow its status. Callbacks are the gateways' own formats and have no
// shared schema; they are read by the adapters.

/** The gateways a payment can be taken through by a tenant (never the fake one in production). */
export const TenantPaymentProviderSchema = PaymentProviderNameSchema;

/** Payer names as gateways accept them (Billplz caps the name at 255). */
const PAYER_NAME_MAX_LENGTH = 255;

/** The body of `POST /tenants/:tenantSlug/payments` (with an `Idempotency-Key` header). */
export const CreatePaymentIntentSchema = z
	.object({
		provider: TenantPaymentProviderSchema,
		amountMinor: PaymentAmountMinorSchema,
		currency: PaymentCurrencySchema.default("MYR"),
		description: z.string().trim().min(1).max(PAYMENT_DESCRIPTION_MAX_LENGTH),
		payerName: z.string().trim().min(1).max(PAYER_NAME_MAX_LENGTH),
		payerEmail: z.email(),
		/** Where the payer returns after checkout: a page of one of the platform's own apps (checked by the API). */
		returnUrl: z.url(),
	})
	.strict();
export type CreatePaymentIntentInput = z.input<typeof CreatePaymentIntentSchema>;
export type CreatePaymentIntent = z.output<typeof CreatePaymentIntentSchema>;

/** A payment as its tenant sees it. */
export const PaymentIntentResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	tenantId: z.uuid(),
	provider: PaymentProviderNameSchema,
	status: PaymentStatusSchema,
	amountMinor: z.number().int(),
	currency: PaymentCurrencySchema,
	description: z.string(),
	payerName: z.string(),
	payerEmail: z.string(),
	/** The gateway's checkout page while the payment can still be paid; null once it is final. */
	checkoutUrl: z.string().nullable(),
	providerPaymentId: z.string().nullable(),
	paidAt: EpochMsSchema.nullable(),
	/** Whether a refund can be asked for through the API (paid, and a gateway with a refund API). */
	refundable: z.boolean(),
});
export type PaymentIntentResponse = z.output<typeof PaymentIntentResponseSchema>;

export const paymentIntentListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(PaymentStatusSchema, { eq: true, in: true }),
		provider: listFilter.enumeration(PaymentProviderNameSchema, { eq: true }),
	},
	params: {},
	defaultLimit: 20,
});
export const PaymentIntentListQuerySchema = paymentIntentListQuery.schema;
export type PaymentIntentListQuery = z.output<typeof PaymentIntentListQuerySchema>;

export const PaymentIntentIdParamsSchema = z.object({ paymentId: z.uuid() }).strict();
export type PaymentIntentIdParams = z.output<typeof PaymentIntentIdParamsSchema>;

/** The answer to a refund request. */
export const PaymentRefundResponseSchema = z.object({
	outcome: z.enum(["refunded", "pending"]),
	payment: PaymentIntentResponseSchema,
});
export type PaymentRefundResponse = z.output<typeof PaymentRefundResponseSchema>;

/** The gateways this deployment can take payments through, in a stable order. */
export const PaymentProvidersResponseSchema = z.object({
	providers: z.array(z.object({ name: PaymentProviderNameSchema, refunds: z.boolean() })),
});
export type PaymentProvidersResponse = z.output<typeof PaymentProvidersResponseSchema>;

/** What a gateway callback is answered with (gateways only look at the status code). */
export const PaymentCallbackResponseSchema = z.object({ received: z.literal(true) });
export type PaymentCallbackResponse = z.output<typeof PaymentCallbackResponseSchema>;
