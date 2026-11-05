import type { PaginatedServiceResult, PaymentIntentListQuery, PaymentProviderName, PaymentStatus } from "@workspace/shared";

import type { PaymentIntent } from "../aggregates/payment-intent.aggregate";

/** What told the platform about a payment (one row of its append-only history). */
export type PaymentEventSource = "CHECKOUT" | "CALLBACK" | "RECONCILE" | "REFUND";

/** What applying the news did (`paymentStatusChange`). */
export type PaymentEventEffect = "APPLIED" | "UNCHANGED" | "IGNORED";

export interface NewPaymentEvent {
	readonly id: string;
	readonly tenantId: string;
	readonly paymentIntentId: string;
	readonly source: PaymentEventSource;
	readonly providerStatus: string;
	readonly status: PaymentStatus;
	readonly effect: PaymentEventEffect;
	readonly amountMinor: number | null;
	readonly occurredAt: number;
	readonly actor: string;
}

/** A payment that may need asking about: still open, with a checkout at its gateway. */
export interface OpenPaymentRef {
	readonly id: string;
	readonly provider: PaymentProviderName;
	readonly providerPaymentId: string;
}

/** Payments and their history, bound to one transaction. */
export interface PaymentIntentRepository {
	findById(tenantId: string, id: string): Promise<PaymentIntent | null>;
	/** One page of the tenant's payments, newest first. */
	list(tenantId: string, query: PaymentIntentListQuery): Promise<PaginatedServiceResult<PaymentIntent>>;
	findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<PaymentIntent | null>;
	findByProviderPaymentId(provider: PaymentProviderName, providerPaymentId: string): Promise<PaymentIntent | null>;
	/** Inserts a new payment. Throws the unique violation of `PaymentIntent_tenantId_idempotencyKey_key` on a concurrent duplicate. */
	insert(intent: PaymentIntent, actor: string): Promise<void>;
	update(intent: PaymentIntent, actor: string): Promise<void>;
	appendEvent(event: NewPaymentEvent): Promise<void>;
	/** Open payments last touched between `from` and `to` (epoch ms), oldest first, at most `limit`. */
	listOpenTouchedBetween(from: number, to: number, limit: number): Promise<readonly OpenPaymentRef[]>;
}

/** The unique index two concurrent creates with the same `Idempotency-Key` collide on. */
export const PAYMENT_IDEMPOTENCY_INDEX = "PaymentIntent_tenantId_idempotencyKey_key";
