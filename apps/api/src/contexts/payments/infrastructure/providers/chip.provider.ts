import type { JsonValue, PaymentStatus } from "@workspace/shared";
import { z } from "zod";

import type {
	CheckoutRequest,
	CheckoutSession,
	PaymentProviderPort,
	ProviderCallback,
	ProviderPaymentUpdate,
	RefundOutcome,
} from "../../application/ports/payment-provider.port";
import { RsaSha256HeaderVerifier, type WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";
import { PaymentProviderError } from "../../domain/errors/payments.errors";
import { fetchProviderHttp, isSuccessStatus, parseJsonBody, type ProviderHttp } from "./provider-http";

// CHIP Collect (https://docs.chip-in.asia, OpenAPI chip-collect.yaml), API v1. Authentication is a Bearer
// secret key. A purchase is a checkout; its success callback is the purchase as JSON, signed in the
// `X-Signature` header: base64 of an RSA PKCS#1 v1.5 signature of the SHA-256 of the raw body, verified with
// the company public key (`GET /public_key/`, configured as CHIP_PUBLIC_KEY) — the shared inbound scheme
// (ADR 081). Refunds go through the API.

export const CHIP_BASE_URL = "https://gate.chip-in.asia/api/v1";
/** The header CHIP signs its callbacks in. */
export const CHIP_SIGNATURE_HEADER = "x-signature";

export interface ChipSettings {
	readonly secretKey: string;
	readonly brandId: string;
	/** The company public key (PEM) that signs success callbacks. */
	readonly publicKeyPem: string;
}

/** The refund answer: the refund Payment, or (when the acquirer is slow) the purchase in `pending_refund`. */
const ChipRefundAnswerSchema = z.object({ status: z.string().optional() });

const ChipPurchaseSchema = z.object({
	id: z.string().min(1),
	status: z.string(),
	reference: z.string().nullable().optional(),
	checkout_url: z.url().nullable().optional(),
	purchase: z.object({ total: z.number().int() }).optional(),
});

/** CHIP's purchase status → the platform's (the full list is `PurchaseStatus` in the OpenAPI document). */
export function chipStatusOf(status: string): PaymentStatus {
	switch (status) {
		// `pending_refund`: a refund being processed; the money is still the merchant's until it completes.
		case "paid":
		case "cleared":
		case "settled":
		case "pending_refund":
			return "PAID";
		case "error":
		case "blocked":
			return "FAILED";
		case "cancelled":
		case "expired":
		case "released":
			return "CANCELLED";
		case "refunded":
		case "chargeback":
			return "REFUNDED";
		default:
			// created, sent, viewed, overdue, hold, preauthorized and the pending_* states: not paid yet.
			return "PENDING";
	}
}

export class ChipPaymentProvider implements PaymentProviderPort {
	public readonly name = "CHIP";
	/** The keyed `X-Signature` check of this gateway's callbacks. */
	public readonly callbackVerifier: WebhookSignatureVerifier;

	public constructor(
		private readonly settings: ChipSettings,
		private readonly http: ProviderHttp = fetchProviderHttp,
	) {
		this.callbackVerifier = new RsaSha256HeaderVerifier(CHIP_SIGNATURE_HEADER, settings.publicKeyPem);
	}

	public async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
		const purchase = await this.call("POST", "/purchases/", {
			brand_id: this.settings.brandId,
			reference: request.paymentId,
			client: { email: request.payerEmail, full_name: request.payerName },
			purchase: { currency: request.currency, products: [{ name: request.description, price: request.amountMinor }] },
			success_redirect: request.returnUrl,
			failure_redirect: request.returnUrl,
			cancel_redirect: request.returnUrl,
			success_callback: request.callbackUrl,
		});
		if (purchase.checkout_url === undefined || purchase.checkout_url === null) {
			throw new PaymentProviderError("CHIP", "no checkout_url");
		}
		return { providerPaymentId: purchase.id, checkoutUrl: purchase.checkout_url };
	}

	public async fetchStatus(providerPaymentId: string): Promise<ProviderPaymentUpdate> {
		return toUpdate(await this.call("GET", `/purchases/${encodeURIComponent(providerPaymentId)}/`));
	}

	public async refund(providerPaymentId: string, amountMinor: number): Promise<RefundOutcome> {
		const answer = ChipRefundAnswerSchema.safeParse(await this.request("POST", `/purchases/${encodeURIComponent(providerPaymentId)}/refund/`, { amount: amountMinor }));
		if (!answer.success) {
			throw new PaymentProviderError("CHIP", "unexpected refund answer");
		}
		// A slow acquirer answers with the purchase in `pending_refund`; otherwise the answer is the refund Payment.
		return answer.data.status === "pending_refund" ? { kind: "pending" } : { kind: "refunded" };
	}

	public readCallback(callback: ProviderCallback): Promise<ProviderPaymentUpdate | null> {
		if (this.callbackVerifier.verify(callback).verdict !== "VALID") {
			return Promise.resolve(null);
		}
		const parsed = ChipPurchaseSchema.safeParse(parseJsonBody(callback.rawBody.toString("utf8")));
		return Promise.resolve(parsed.success ? toUpdate(parsed.data) : null);
	}

	private async call(method: "GET" | "POST", path: string, body?: JsonValue): Promise<z.output<typeof ChipPurchaseSchema>> {
		const parsed = ChipPurchaseSchema.safeParse(await this.request(method, path, body));
		if (!parsed.success) {
			throw new PaymentProviderError("CHIP", "unexpected answer");
		}
		return parsed.data;
	}

	/** One authenticated call; the answer as JSON (null when it isn't JSON). */
	private async request(method: "GET" | "POST", path: string, body?: JsonValue): Promise<JsonValue | null> {
		const response = await this.http(`${CHIP_BASE_URL}${path}`, {
			method,
			headers: { Authorization: `Bearer ${this.settings.secretKey}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		if (!isSuccessStatus(response.status)) {
			throw new PaymentProviderError("CHIP", `HTTP ${String(response.status)}`);
		}
		return parseJsonBody(response.text);
	}
}

function toUpdate(purchase: z.output<typeof ChipPurchaseSchema>): ProviderPaymentUpdate {
	return {
		providerPaymentId: purchase.id,
		paymentId: purchase.reference ?? null,
		status: chipStatusOf(purchase.status),
		providerStatus: purchase.status,
		amountMinor: purchase.purchase?.total ?? null,
	};
}
