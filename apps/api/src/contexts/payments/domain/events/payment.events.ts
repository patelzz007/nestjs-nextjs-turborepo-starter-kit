import type { EpochMs, PaymentCurrency, PaymentProviderName } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";
import type { PaymentIntentState } from "../aggregates/payment-intent.aggregate";

/** The settled statuses another context can react to (a webhook to the tenant's systems, ADR 082). */
export type SettledPaymentStatus = "PAID" | "FAILED" | "REFUNDED";

/** A payment reached a settled status (applied once: a repeated callback with the same news records nothing). */
export class PaymentStatusChanged extends DomainEvent {
	public readonly eventName = "payments.PaymentStatusChanged";
	public readonly paymentId: string;
	public readonly tenantId: string;
	public readonly provider: PaymentProviderName;
	public readonly amountMinor: number;
	public readonly currency: PaymentCurrency;
	public readonly providerPaymentId: string | null;
	public readonly paidAt: EpochMs | null;

	public constructor(
		occurredAt: EpochMs,
		payment: Pick<PaymentIntentState, "id" | "tenantId" | "provider" | "amountMinor" | "currency" | "providerPaymentId">,
		paidAt: EpochMs | null,
		public readonly status: SettledPaymentStatus,
	) {
		super(occurredAt);
		this.paymentId = payment.id;
		this.tenantId = payment.tenantId;
		this.provider = payment.provider;
		this.amountMinor = payment.amountMinor;
		this.currency = payment.currency;
		this.providerPaymentId = payment.providerPaymentId;
		this.paidAt = paidAt;
	}
}
