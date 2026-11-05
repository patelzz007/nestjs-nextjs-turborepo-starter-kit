import { PaymentStatusSchema, type PaymentStatus } from "@workspace/shared";
import { z } from "zod";

import type {
	CheckoutRequest,
	CheckoutSession,
	PaymentProviderPort,
	ProviderCallback,
	ProviderPaymentUpdate,
	RefundOutcome,
} from "../../application/ports/payment-provider.port";
import { HmacSha256HeaderVerifier, hmacSha256HeaderSignature, type HmacSha256HeaderScheme, type WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";
import { PaymentProviderError } from "../../domain/errors/payments.errors";
import { parseJsonBody } from "./provider-http";

// The deterministic gateway for tests and local development (ADR 020): checkouts live in memory, the checkout
// URL points at the platform's own return URL, and callbacks are JSON signed with HMAC-SHA256 (hex) in
// `x-fake-signature` with a configured secret (the shared inbound scheme, ADR 081). It runs the same
// contract tests as Billplz and CHIP.

/** Where the fake gateway signs its callbacks: the bare hex HMAC-SHA256 of the raw body. */
export const FAKE_SIGNATURE_SCHEME: HmacSha256HeaderScheme = { header: "x-fake-signature", prefix: "" };

const FakeCallbackSchema = z.object({ id: z.string().min(1), reference: z.string().nullable(), status: PaymentStatusSchema, amount: z.number().int() });

interface FakePayment {
	readonly paymentId: string;
	readonly amountMinor: number;
	status: PaymentStatus;
}

export class FakePaymentProvider implements PaymentProviderPort {
	public readonly name = "FAKE";
	/** The keyed `x-fake-signature` check of this gateway's callbacks. */
	public readonly callbackVerifier: WebhookSignatureVerifier;
	private readonly payments = new Map<string, FakePayment>();

	public constructor(private readonly secret: string) {
		this.callbackVerifier = new HmacSha256HeaderVerifier(FAKE_SIGNATURE_SCHEME, secret);
	}

	public createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
		// Named after the payment itself: unique across restarts. A counter started again at fake_1 with every new
		// API process, colliding with the payments an earlier process had already stored (provider ids are unique).
		const providerPaymentId = `fake_${request.paymentId}`;
		this.payments.set(providerPaymentId, { paymentId: request.paymentId, amountMinor: request.amountMinor, status: "PENDING" });
		const checkoutUrl = new URL(request.returnUrl);
		checkoutUrl.searchParams.set("fake_payment", providerPaymentId);
		return Promise.resolve({ providerPaymentId, checkoutUrl: checkoutUrl.toString() });
	}

	public fetchStatus(providerPaymentId: string): Promise<ProviderPaymentUpdate> {
		const payment = this.require(providerPaymentId);
		return Promise.resolve({ providerPaymentId, paymentId: payment.paymentId, status: payment.status, providerStatus: payment.status, amountMinor: payment.amountMinor });
	}

	public refund(providerPaymentId: string): Promise<RefundOutcome> {
		this.require(providerPaymentId).status = "REFUNDED";
		return Promise.resolve({ kind: "refunded" });
	}

	public readCallback(callback: ProviderCallback): Promise<ProviderPaymentUpdate | null> {
		if (this.callbackVerifier.verify(callback).verdict !== "VALID") {
			return Promise.resolve(null);
		}
		const parsed = FakeCallbackSchema.safeParse(parseJsonBody(callback.rawBody.toString("utf8")));
		if (!parsed.success) {
			return Promise.resolve(null);
		}
		const { id, reference, status, amount } = parsed.data;
		return Promise.resolve({ providerPaymentId: id, paymentId: reference, status, providerStatus: status, amountMinor: amount });
	}

	/** Test and local-development helper: what the fake gateway would post when the payer finishes. */
	public signedCallback(providerPaymentId: string, status: PaymentStatus): ProviderCallback {
		const payment = this.require(providerPaymentId);
		payment.status = status;
		const rawBody = Buffer.from(JSON.stringify({ id: providerPaymentId, reference: payment.paymentId, status, amount: payment.amountMinor }));
		return { rawBody, headers: { [FAKE_SIGNATURE_SCHEME.header]: this.sign(rawBody) } };
	}

	private sign(rawBody: Buffer): string {
		return hmacSha256HeaderSignature(FAKE_SIGNATURE_SCHEME, this.secret, rawBody);
	}

	private require(providerPaymentId: string): FakePayment {
		const payment = this.payments.get(providerPaymentId);
		if (payment === undefined) {
			throw new PaymentProviderError("FAKE", `unknown payment ${providerPaymentId}`);
		}
		return payment;
	}
}
