import type { PaymentCurrency, PaymentProviderName, PaymentStatus } from "@workspace/shared";

import { PaymentNotRefundableError } from "../errors/payments.errors";
import { paymentStatusChange, type PaymentStatusChange } from "../policies/payment-status.policy";

/** A payment the platform asked a gateway to take (ADR 020): provider-neutral, the gateway's ids only as strings. */
export interface PaymentIntentState {
	readonly id: string;
	readonly tenantId: string;
	readonly provider: PaymentProviderName;
	readonly status: PaymentStatus;
	readonly amountMinor: number;
	readonly currency: PaymentCurrency;
	readonly description: string;
	readonly payerName: string;
	readonly payerEmail: string;
	/** The caller's `Idempotency-Key`: the same key always means the same payment. */
	readonly idempotencyKey: string;
	/** The gateway's id (Billplz bill id, CHIP purchase id), once checkout exists. */
	readonly providerPaymentId: string | null;
	readonly checkoutUrl: string | null;
	readonly paidAt: number | null;
	readonly createdAt: number;
	readonly updatedAt: number;
}

export interface NewPaymentIntent {
	readonly id: string;
	readonly tenantId: string;
	readonly provider: PaymentProviderName;
	readonly amountMinor: number;
	readonly currency: PaymentCurrency;
	readonly description: string;
	readonly payerName: string;
	readonly payerEmail: string;
	readonly idempotencyKey: string;
}

/** The aggregate: holds the state and the only ways it may change. */
export class PaymentIntent {
	private constructor(private state: PaymentIntentState) {}

	public static create(input: NewPaymentIntent, now: number): PaymentIntent {
		return new PaymentIntent({ ...input, status: "PENDING", providerPaymentId: null, checkoutUrl: null, paidAt: null, createdAt: now, updatedAt: now });
	}

	public static restore(state: PaymentIntentState): PaymentIntent {
		return new PaymentIntent(state);
	}

	public get snapshot(): PaymentIntentState {
		return this.state;
	}

	/** Records the gateway's checkout once it was created. */
	public attachCheckout(providerPaymentId: string, checkoutUrl: string, now: number): void {
		this.state = { ...this.state, providerPaymentId, checkoutUrl, updatedAt: now };
	}

	/** Applies the gateway's news (a callback, a redirect, a status poll); safe in any order and any number of times. */
	public applyProviderStatus(status: PaymentStatus, now: number): PaymentStatusChange {
		const change = paymentStatusChange(this.state.status, status);
		if (change === "applied") {
			this.state = { ...this.state, status, updatedAt: now, paidAt: status === "PAID" ? now : this.state.paidAt };
		}
		return change;
	}

	/**
	 * Whether `request` asks for the same payment this one is (same gateway, amount, text and payer): a
	 * retried `Idempotency-Key` must repeat its request exactly, or it is refused. The currency has one value
	 * today (MYR), so it can't differ; compare it here when a second currency is added.
	 */
	public isSameRequestAs(request: Omit<NewPaymentIntent, "id" | "tenantId" | "idempotencyKey">): boolean {
		const { provider, amountMinor, description, payerName, payerEmail } = this.state;
		return (
			provider === request.provider &&
			amountMinor === request.amountMinor &&
			description === request.description &&
			payerName === request.payerName &&
			payerEmail === request.payerEmail
		);
	}

	/** Guards a refund request: only a paid payment can be refunded. */
	public assertRefundable(): void {
		if (this.state.status !== "PAID") {
			throw new PaymentNotRefundableError(this.state.status);
		}
	}
}
