// The contract every payment adapter keeps (ADR 020: "the fake adapter must be kept honest by contract
// tests that a real adapter will also run"). Each adapter runs the same cases against a scripted gateway.
import { generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { CheckoutRequest, PaymentProviderPort, ProviderCallback } from "../../../application/ports/payment-provider.port";
import { billplzSignature } from "../../../../webhooks/inbound/public-api";
import { BillplzPaymentProvider } from "../billplz.provider";
import { ChipPaymentProvider } from "../chip.provider";
import { FakePaymentProvider } from "../fake.provider";
import { scriptedHttp } from "./provider-fakes";

const CHECKOUT: CheckoutRequest = {
	paymentId: "pi-1",
	amountMinor: 1_000,
	currency: "MYR",
	description: "Order",
	payerName: "Payer",
	payerEmail: "payer@example.com",
	returnUrl: "https://app.example.com/return",
	callbackUrl: "https://api.example.com/callback",
};
const RSA = generateKeyPairSync("rsa", { modulusLength: 2048 });

interface ContractCase {
	readonly name: string;
	/** An adapter whose gateway answers the checkout call. */
	readonly provider: () => PaymentProviderPort;
	/** A genuine "paid" callback for the checkout just created. */
	readonly paidCallback: (provider: PaymentProviderPort, providerPaymentId: string) => ProviderCallback;
	/** The same callback with its signature taken away, wherever this gateway carries it. */
	readonly unsigned: (callback: ProviderCallback) => ProviderCallback;
}

/** Drops the signature header(s), for the gateways that sign in a header. */
function withoutHeaders(callback: ProviderCallback): ProviderCallback {
	return { rawBody: callback.rawBody, headers: {} };
}

const CASES: readonly ContractCase[] = [
	{
		name: "Billplz",
		provider: () =>
			new BillplzPaymentProvider(
				{ apiKey: "k", collectionId: "c", xSignatureKey: "x", sandbox: true },
				scriptedHttp([{ status: 200, body: JSON.stringify({ id: "bill_1", url: "https://www.billplz-sandbox.com/bills/bill_1", paid: false, state: "due", amount: 1_000 }) }])
					.http,
			),
		paidCallback: (_provider, id) => {
			const fields = { id, paid: "true", state: "paid", amount: "1000" };
			return { rawBody: Buffer.from(new URLSearchParams({ ...fields, x_signature: billplzSignature(new Map(Object.entries(fields)), "x") }).toString()), headers: {} };
		},
		// Billplz signs inside the form body: remove the `x_signature` field.
		unsigned: (callback) => {
			const fields = new URLSearchParams(callback.rawBody.toString());
			fields.delete("x_signature");
			return { rawBody: Buffer.from(fields.toString()), headers: {} };
		},
	},
	{
		name: "CHIP",
		provider: () =>
			new ChipPaymentProvider(
				{ secretKey: "s", brandId: "b", publicKeyPem: RSA.publicKey.export({ type: "spki", format: "pem" }) },
				scriptedHttp([{ status: 201, body: JSON.stringify({ id: "pur_1", status: "created", reference: "pi-1", checkout_url: "https://gate.chip-in.asia/p/pur_1/" }) }]).http,
			),
		paidCallback: (_provider, id) => {
			const rawBody = Buffer.from(JSON.stringify({ id, status: "paid", reference: "pi-1", purchase: { total: 1_000 } }));
			return { rawBody, headers: { "x-signature": sign("sha256", rawBody, RSA.privateKey).toString("base64") } };
		},
		unsigned: withoutHeaders,
	},
	{
		name: "Fake",
		provider: () => new FakePaymentProvider("fake-secret"),
		paidCallback: (provider, id) => (provider instanceof FakePaymentProvider ? provider.signedCallback(id, "PAID") : { rawBody: Buffer.alloc(0), headers: {} }),
		unsigned: withoutHeaders,
	},
];

describe.each(CASES)("payment adapter contract: $name", ({ provider: makeProvider, paidCallback, unsigned }) => {
	it("opens a checkout with an id and a URL to send the payer to", async () => {
		const session = await makeProvider().createCheckout(CHECKOUT);
		expect(session.providerPaymentId.length).toBeGreaterThan(0);
		expect(new URL(session.checkoutUrl).protocol).toBe("https:");
	});

	it("reads a genuine paid callback as PAID for that checkout, with the amount", async () => {
		const provider = makeProvider();
		const session = await provider.createCheckout(CHECKOUT);
		const update = await provider.readCallback(paidCallback(provider, session.providerPaymentId));
		expect(update).toMatchObject({ providerPaymentId: session.providerPaymentId, status: "PAID", amountMinor: 1_000 });
	});

	it("refuses an unsigned callback without reading it", async () => {
		const provider = makeProvider();
		const session = await provider.createCheckout(CHECKOUT);
		await expect(provider.readCallback(unsigned(paidCallback(provider, session.providerPaymentId)))).resolves.toBeNull();
	});
});
