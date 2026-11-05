import type { PaymentStatus } from "@workspace/shared";
import { z } from "zod";

import type {
	CheckoutRequest,
	CheckoutSession,
	PaymentProviderPort,
	ProviderCallback,
	ProviderPaymentUpdate,
	RefundOutcome,
} from "../../application/ports/payment-provider.port";
import { BillplzSignatureVerifier, formFields, type WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";
import { PaymentProviderError } from "../../domain/errors/payments.errors";
import { fetchProviderHttp, isSuccessStatus, parseJsonBody, type ProviderHttp } from "./provider-http";

// Billplz (https://support.billplz.com/api), Bills v3. Authentication is HTTP Basic with the API secret key
// as the user name. A bill is a checkout page; its callback is a form POST signed with `x_signature` (the
// shared inbound scheme, ADR 081): HMAC-SHA256, keyed by the X Signature key, over every other field as
// `key + value`, sorted ascending (case-insensitive) and joined with `|`. Billplz has no refund API: refunds
// are made in its dashboard.

export const BILLPLZ_BASE_URLS = { production: "https://www.billplz.com/api", sandbox: "https://www.billplz-sandbox.com/api" } satisfies Readonly<Record<string, string>>;

export interface BillplzSettings {
	readonly apiKey: string;
	readonly collectionId: string;
	readonly xSignatureKey: string;
	readonly sandbox: boolean;
}

const BillplzBillSchema = z.object({
	id: z.string().min(1),
	url: z.url(),
	paid: z.boolean(),
	state: z.string(),
	amount: z.number().int(),
	reference_1: z.string().nullable().optional(),
});

const BillplzCallbackSchema = z.object({
	id: z.string().min(1),
	paid: z.enum(["true", "false"]),
	state: z.string(),
	amount: z.coerce.number().int(),
});

/** Billplz's bill state → the platform's. A bill is paid, still due, or deleted (no longer payable). */
export function billplzStatusOf(paid: boolean, state: string): PaymentStatus {
	if (paid) {
		return "PAID";
	}
	return state === "deleted" ? "CANCELLED" : "PENDING";
}

export class BillplzPaymentProvider implements PaymentProviderPort {
	public readonly name = "BILLPLZ";
	/** The keyed `x_signature` check of this gateway's callbacks. */
	public readonly callbackVerifier: WebhookSignatureVerifier;

	public constructor(
		private readonly settings: BillplzSettings,
		private readonly http: ProviderHttp = fetchProviderHttp,
	) {
		this.callbackVerifier = new BillplzSignatureVerifier(settings.xSignatureKey);
	}

	private get baseUrl(): string {
		return this.settings.sandbox ? BILLPLZ_BASE_URLS.sandbox : BILLPLZ_BASE_URLS.production;
	}

	private get authorization(): string {
		return `Basic ${Buffer.from(`${this.settings.apiKey}:`).toString("base64")}`;
	}

	public async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
		const body = new URLSearchParams({
			collection_id: this.settings.collectionId,
			email: request.payerEmail,
			name: request.payerName,
			amount: String(request.amountMinor),
			description: request.description,
			callback_url: request.callbackUrl,
			redirect_url: request.returnUrl,
			reference_1_label: "Payment",
			reference_1: request.paymentId,
		});
		const bill = await this.call("POST", "/v3/bills", body.toString());
		return { providerPaymentId: bill.id, checkoutUrl: bill.url };
	}

	public async fetchStatus(providerPaymentId: string): Promise<ProviderPaymentUpdate> {
		const bill = await this.call("GET", `/v3/bills/${encodeURIComponent(providerPaymentId)}`);
		return {
			providerPaymentId: bill.id,
			paymentId: bill.reference_1 ?? null,
			status: billplzStatusOf(bill.paid, bill.state),
			providerStatus: bill.state,
			amountMinor: bill.amount,
		};
	}

	public refund(): Promise<RefundOutcome> {
		return Promise.resolve({ kind: "unsupported" });
	}

	public readCallback(callback: ProviderCallback): Promise<ProviderPaymentUpdate | null> {
		if (this.callbackVerifier.verify(callback).verdict !== "VALID") {
			return Promise.resolve(null);
		}
		const parsed = BillplzCallbackSchema.safeParse(Object.fromEntries(formFields(callback.rawBody)));
		if (!parsed.success) {
			return Promise.resolve(null);
		}
		const { id, paid, state, amount } = parsed.data;
		return Promise.resolve({ providerPaymentId: id, paymentId: null, status: billplzStatusOf(paid === "true", state), providerStatus: state, amountMinor: amount });
	}

	private async call(method: "GET" | "POST", path: string, body?: string): Promise<z.output<typeof BillplzBillSchema>> {
		const response = await this.http(`${this.baseUrl}${path}`, {
			method,
			headers: { Authorization: this.authorization, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/x-www-form-urlencoded" }) },
			...(body === undefined ? {} : { body }),
		});
		if (!isSuccessStatus(response.status)) {
			throw new PaymentProviderError("BILLPLZ", `HTTP ${String(response.status)}`);
		}
		const parsed = BillplzBillSchema.safeParse(parseJsonBody(response.text));
		if (!parsed.success) {
			throw new PaymentProviderError("BILLPLZ", "unexpected answer");
		}
		return parsed.data;
	}
}
