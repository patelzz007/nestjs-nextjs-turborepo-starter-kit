import type { PaymentCurrency, PaymentProviderName, PaymentStatus } from "@workspace/shared";

// The provider-neutral payment port (ADR 020). Each gateway is one adapter behind it; nothing outside the
// adapter sees a gateway's request shapes, ids' meaning or signature scheme.

/** What the platform asks a gateway to take. */
export interface CheckoutRequest {
	/** The platform's payment id: sent as the gateway's reference, so a callback can be matched to it. */
	readonly paymentId: string;
	readonly amountMinor: number;
	readonly currency: PaymentCurrency;
	readonly description: string;
	readonly payerName: string;
	readonly payerEmail: string;
	/** Where the payer's browser returns after checkout. */
	readonly returnUrl: string;
	/** Where the gateway posts its server-to-server callback. */
	readonly callbackUrl: string;
}

/** A checkout the gateway opened. */
export interface CheckoutSession {
	readonly providerPaymentId: string;
	/** Where to send the payer. */
	readonly checkoutUrl: string;
}

/** A gateway's news about one payment, already mapped to the platform's statuses. */
export interface ProviderPaymentUpdate {
	readonly providerPaymentId: string;
	/** The platform's payment id, when the gateway echoes the reference back. */
	readonly paymentId: string | null;
	readonly status: PaymentStatus;
	/** The gateway's own status word, kept for the payment's event log. */
	readonly providerStatus: string;
	readonly amountMinor: number | null;
}

/** An inbound callback exactly as it arrived: the raw body (signatures cover the bytes) and the headers. */
export interface ProviderCallback {
	readonly rawBody: Buffer;
	readonly headers: Readonly<Record<string, string | undefined>>;
}

/** The answer to a refund request. */
export type RefundOutcome =
	| { readonly kind: "refunded" }
	/** The gateway accepted it; the final answer comes in a later callback. */
	| { readonly kind: "pending" }
	/** This gateway can't refund through its API (Billplz): refund in its dashboard. */
	| { readonly kind: "unsupported" };

export interface PaymentProviderPort {
	readonly name: PaymentProviderName;
	createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
	/** The payment's current status, read from the gateway (reconciliation, and after a return redirect). */
	fetchStatus(providerPaymentId: string): Promise<ProviderPaymentUpdate>;
	refund(providerPaymentId: string, amountMinor: number): Promise<RefundOutcome>;
	/**
	 * Verifies a callback's signature and reads it. `null` when the signature is missing or wrong: the
	 * caller answers 401 and changes nothing. Never trusts a field before the signature checked out.
	 */
	readCallback(callback: ProviderCallback): Promise<ProviderPaymentUpdate | null>;
}
