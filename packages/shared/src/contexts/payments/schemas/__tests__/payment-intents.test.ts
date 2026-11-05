import { describe, expect, it } from "vitest";

import { CreatePaymentIntentSchema, PaymentIntentListQuerySchema } from "../payment-intents";

const VALID = {
	provider: "CHIP",
	amountMinor: 1_500,
	description: "Order 42",
	payerName: "Aisyah",
	payerEmail: "aisyah@example.com",
	returnUrl: "https://merchant.example.com/pay/return",
};

describe("CreatePaymentIntentSchema", () => {
	it("accepts a payment request and defaults the currency to ringgit", () => {
		expect(CreatePaymentIntentSchema.parse(VALID)).toStrictEqual({ ...VALID, currency: "MYR" });
	});

	it("refuses unknown gateways, amounts out of range, bad emails, blank text and extra fields", () => {
		for (const change of [
			{ provider: "PAYPAL" },
			{ amountMinor: 50 },
			{ amountMinor: 10.5 },
			{ payerEmail: "nope" },
			{ description: "  " },
			{ returnUrl: "not a url" },
			{ tenantId: "x" },
		]) {
			expect({ change, ok: CreatePaymentIntentSchema.safeParse({ ...VALID, ...change }).success }).toStrictEqual({ change, ok: false });
		}
	});
});

describe("PaymentIntentListQuerySchema", () => {
	it("filters by status and gateway, newest first by default", () => {
		const query = PaymentIntentListQuerySchema.parse({ filter: { status: "PAID", provider: "CHIP" } });
		expect(query.limit).toBe(20);
		expect(query.filter).toStrictEqual({ status: { eq: "PAID" }, provider: { eq: "CHIP" } });
		expect(PaymentIntentListQuerySchema.safeParse({ filter: { status: "LOST" } }).success).toBe(false);
	});
});
