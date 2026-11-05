"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { IDEMPOTENCY_KEY_HEADER, type CreatePaymentIntent, type PaymentIntentResponse } from "@workspace/shared";

/** One "create payment" call: the checked request and the key it is sent with. */
export interface CreatePaymentCall {
	readonly tenantSlug: string;
	readonly request: CreatePaymentIntent;
	readonly idempotencyKey: string;
}

/**
 * `POST /tenants/:tenantSlug/payments` with its `Idempotency-Key` header (the generated mutation hook has no
 * per-call headers, so the call goes through the procedure's own caller, as kanban comments do).
 */
export function useCreatePayment(): UseMutationResult<PaymentIntentResponse, Error, CreatePaymentCall> {
	const { api } = useAuth();
	return useMutation({
		mutationFn: async ({ tenantSlug, request, idempotencyKey }: CreatePaymentCall): Promise<PaymentIntentResponse> =>
			(await api.tenantPayments.createPayment.mutate({ tenantSlug, ...request }, { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } })).data,
	});
}
