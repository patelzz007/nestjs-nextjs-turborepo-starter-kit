import { describe, expect, it } from "vitest";

import type { CheckoutRequest } from "../../../application/ports/payment-provider.port";

import { PaymentProviderError } from "../../../domain/errors/payments.errors";
import { billplzSignature, billplzSignatureSource } from "../../../../webhooks/inbound/public-api";
import { BILLPLZ_BASE_URLS, BillplzPaymentProvider, billplzStatusOf } from "../billplz.provider";
import { scriptedHttp } from "./provider-fakes";

const SETTINGS = { apiKey: "api-key", collectionId: "col_1", xSignatureKey: "x-signature-key", sandbox: true };
const CHECKOUT: CheckoutRequest = {
	paymentId: "pi-1",
	amountMinor: 1_500,
	currency: "MYR",
	description: "Order 42",
	payerName: "Aisyah",
	payerEmail: "aisyah@example.com",
	returnUrl: "https://app.example.com/pay/return",
	callbackUrl: "https://api.example.com/v1/payments/callbacks/billplz",
};
const BILL = { id: "bill_1", url: "https://www.billplz-sandbox.com/bills/bill_1", paid: false, state: "due", amount: 1_500, reference_1: "pi-1" };

/** A callback body as Billplz posts it, signed with `key`. */
function callbackBody(fields: Record<string, string>, key: string): Buffer {
	const signature = billplzSignature(new Map(Object.entries(fields)), key);
	return Buffer.from(new URLSearchParams({ ...fields, x_signature: signature }).toString());
}

const PAID_FIELDS = {
	id: "bill_1",
	collection_id: "col_1",
	paid: "true",
	state: "paid",
	amount: "1500",
	paid_amount: "1500",
	due_at: "2026-11-03",
	email: "aisyah@example.com",
	mobile: "",
	name: "AISYAH",
	url: BILL.url,
	paid_at: "2026-11-03 12:00:00 +0800",
};

describe("the Billplz signature", () => {
	it("joins key+value pairs, sorted case-insensitively, with pipes, leaving the signature out (empty values keep the key)", () => {
		expect(
			billplzSignatureSource(
				new Map([
					["paid", "true"],
					["Amount", "100"],
					["id", "x"],
					["mobile", ""],
					["x_signature", "sig"],
				]),
			),
		).toBe("Amount100|idx|mobile|paidtrue");
	});
});

describe("BillplzPaymentProvider", () => {
	it("creates a bill in the sandbox with Basic auth, the amount in sen and the payment id as reference", async () => {
		const gateway = scriptedHttp([{ status: 200, body: JSON.stringify(BILL) }]);
		const session = await new BillplzPaymentProvider(SETTINGS, gateway.http).createCheckout(CHECKOUT);
		expect(session).toStrictEqual({ providerPaymentId: "bill_1", checkoutUrl: BILL.url });
		const [call] = gateway.calls;
		expect(call?.url).toBe(`${BILLPLZ_BASE_URLS.sandbox}/v3/bills`);
		expect(call?.request.headers.Authorization).toBe(`Basic ${Buffer.from("api-key:").toString("base64")}`);
		const sent = new URLSearchParams(call?.request.body ?? "");
		expect(Object.fromEntries(sent)).toMatchObject({
			collection_id: "col_1",
			amount: "1500",
			email: "aisyah@example.com",
			reference_1: "pi-1",
			callback_url: CHECKOUT.callbackUrl,
			redirect_url: CHECKOUT.returnUrl,
		});
	});

	it("uses the production host unless sandboxed, and reads a bill's status", async () => {
		const gateway = scriptedHttp([{ status: 200, body: JSON.stringify({ ...BILL, paid: true, state: "paid" }) }]);
		const update = await new BillplzPaymentProvider({ ...SETTINGS, sandbox: false }, gateway.http).fetchStatus("bill_1");
		expect(gateway.calls.map((call) => call.url)).toStrictEqual([`${BILLPLZ_BASE_URLS.production}/v3/bills/bill_1`]);
		expect(update).toStrictEqual({ providerPaymentId: "bill_1", paymentId: "pi-1", status: "PAID", providerStatus: "paid", amountMinor: 1_500 });
	});

	it("maps bill states: paid, due, deleted", () => {
		expect([billplzStatusOf(true, "paid"), billplzStatusOf(false, "due"), billplzStatusOf(false, "deleted")]).toStrictEqual(["PAID", "PENDING", "CANCELLED"]);
	});

	it("accepts a correctly signed callback, and refuses a forged, tampered or unsigned one", async () => {
		const provider = new BillplzPaymentProvider(SETTINGS);
		await expect(provider.readCallback({ rawBody: callbackBody(PAID_FIELDS, SETTINGS.xSignatureKey), headers: {} })).resolves.toStrictEqual({
			providerPaymentId: "bill_1",
			paymentId: null,
			status: "PAID",
			providerStatus: "paid",
			amountMinor: 1_500,
		});
		await expect(provider.readCallback({ rawBody: callbackBody(PAID_FIELDS, "someone-else"), headers: {} })).resolves.toBeNull();
		const tampered = Buffer.from(callbackBody(PAID_FIELDS, SETTINGS.xSignatureKey).toString().replace("amount=1500", "amount=1"));
		await expect(provider.readCallback({ rawBody: tampered, headers: {} })).resolves.toBeNull();
		await expect(provider.readCallback({ rawBody: Buffer.from(new URLSearchParams(PAID_FIELDS).toString()), headers: {} })).resolves.toBeNull();
	});

	it("can't refund through the API, and reports a refused call as a provider error", async () => {
		await expect(new BillplzPaymentProvider(SETTINGS).refund()).resolves.toStrictEqual({ kind: "unsupported" });
		const gateway = scriptedHttp([
			{ status: 422, body: "{}" },
			{ status: 200, body: "<html>" },
		]);
		const provider = new BillplzPaymentProvider(SETTINGS, gateway.http);
		await expect(provider.createCheckout(CHECKOUT)).rejects.toBeInstanceOf(PaymentProviderError);
		await expect(provider.fetchStatus("bill_1")).rejects.toBeInstanceOf(PaymentProviderError);
	});
});
