import { generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { CheckoutRequest } from "../../../application/ports/payment-provider.port";

import { PaymentProviderError } from "../../../domain/errors/payments.errors";
import { CHIP_BASE_URL, ChipPaymentProvider, chipStatusOf } from "../chip.provider";
import { scriptedHttp } from "./provider-fakes";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const OTHER = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SETTINGS = { secretKey: "secret", brandId: "brand-1", publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) };
const CHECKOUT: CheckoutRequest = {
	paymentId: "pi-1",
	amountMinor: 2_500,
	currency: "MYR",
	description: "Order 7",
	payerName: "Wei Ling",
	payerEmail: "weiling@example.com",
	returnUrl: "https://app.example.com/pay/return",
	callbackUrl: "https://api.example.com/v1/payments/callbacks/chip",
};
const PURCHASE = { id: "pur_1", status: "created", reference: "pi-1", checkout_url: "https://gate.chip-in.asia/p/pur_1/", purchase: { total: 2_500 } };

/** A callback as CHIP sends it: the raw JSON body and its base64 RSA-SHA256 signature. */
function signedCallback(body: object, key = privateKey): { readonly rawBody: Buffer; readonly headers: Record<string, string> } {
	const rawBody = Buffer.from(JSON.stringify(body));
	return { rawBody, headers: { "x-signature": sign("sha256", rawBody, key).toString("base64") } };
}

describe("ChipPaymentProvider", () => {
	it("creates a purchase with Bearer auth, the brand, the amount in sen and the payment id as reference", async () => {
		const gateway = scriptedHttp([{ status: 201, body: JSON.stringify(PURCHASE) }]);
		await expect(new ChipPaymentProvider(SETTINGS, gateway.http).createCheckout(CHECKOUT)).resolves.toStrictEqual({
			providerPaymentId: "pur_1",
			checkoutUrl: PURCHASE.checkout_url,
		});
		const [call] = gateway.calls;
		expect(call?.url).toBe(`${CHIP_BASE_URL}/purchases/`);
		expect(call?.request.headers.Authorization).toBe("Bearer secret");
		expect(JSON.parse(call?.request.body ?? "{}")).toMatchObject({
			brand_id: "brand-1",
			reference: "pi-1",
			client: { email: "weiling@example.com" },
			purchase: { currency: "MYR", products: [{ name: "Order 7", price: 2_500 }] },
			success_callback: CHECKOUT.callbackUrl,
			success_redirect: CHECKOUT.returnUrl,
		});
	});

	it("maps every purchase status", () => {
		const cases: Record<string, string> = {
			paid: "PAID",
			cleared: "PAID",
			settled: "PAID",
			pending_refund: "PAID",
			error: "FAILED",
			blocked: "FAILED",
			cancelled: "CANCELLED",
			expired: "CANCELLED",
			released: "CANCELLED",
			refunded: "REFUNDED",
			chargeback: "REFUNDED",
			created: "PENDING",
			viewed: "PENDING",
			overdue: "PENDING",
			hold: "PENDING",
		};
		for (const [chip, platform] of Object.entries(cases)) {
			expect({ chip, status: chipStatusOf(chip) }).toStrictEqual({ chip, status: platform });
		}
	});

	it("accepts a callback signed by CHIP's key, and refuses one signed by another key, tampered, or unsigned", async () => {
		const provider = new ChipPaymentProvider(SETTINGS);
		const paid = { ...PURCHASE, status: "paid" };
		await expect(provider.readCallback(signedCallback(paid))).resolves.toStrictEqual({
			providerPaymentId: "pur_1",
			paymentId: "pi-1",
			status: "PAID",
			providerStatus: "paid",
			amountMinor: 2_500,
		});
		await expect(provider.readCallback(signedCallback(paid, OTHER.privateKey))).resolves.toBeNull();
		const genuine = signedCallback(paid);
		await expect(provider.readCallback({ rawBody: Buffer.from(genuine.rawBody.toString().replace("2500", "1")), headers: genuine.headers })).resolves.toBeNull();
		await expect(provider.readCallback({ rawBody: genuine.rawBody, headers: {} })).resolves.toBeNull();
		await expect(provider.readCallback({ rawBody: genuine.rawBody, headers: { "x-signature": "not base64 at all" } })).resolves.toBeNull();
	});

	it("refunds through the API: done, or pending when the acquirer is slow", async () => {
		const gateway = scriptedHttp([
			{ status: 200, body: JSON.stringify({ id: "pay_9", status: "paid" }) },
			{ status: 200, body: JSON.stringify({ ...PURCHASE, status: "pending_refund" }) },
		]);
		const provider = new ChipPaymentProvider(SETTINGS, gateway.http);
		await expect(provider.refund("pur_1", 2_500)).resolves.toStrictEqual({ kind: "refunded" });
		await expect(provider.refund("pur_1", 1_000)).resolves.toStrictEqual({ kind: "pending" });
		expect(gateway.calls.map((call) => [call.url, call.request.body])).toStrictEqual([
			[`${CHIP_BASE_URL}/purchases/pur_1/refund/`, '{"amount":2500}'],
			[`${CHIP_BASE_URL}/purchases/pur_1/refund/`, '{"amount":1000}'],
		]);
	});

	it("reports a refused call or an answer without a checkout as a provider error", async () => {
		const gateway = scriptedHttp([
			{ status: 400, body: "{}" },
			{ status: 201, body: JSON.stringify({ ...PURCHASE, checkout_url: null }) },
		]);
		const provider = new ChipPaymentProvider(SETTINGS, gateway.http);
		await expect(provider.createCheckout(CHECKOUT)).rejects.toBeInstanceOf(PaymentProviderError);
		await expect(provider.createCheckout(CHECKOUT)).rejects.toBeInstanceOf(PaymentProviderError);
	});
});
