import { describe, expect, it } from "vitest";

import { PAYMENT_MAX_AMOUNT_MINOR, PAYMENT_MIN_AMOUNT_MINOR, PaymentAmountMinorSchema, PaymentProviderNameSchema, PaymentStatusSchema } from "../payments";

describe("the payments vocabulary", () => {
	it("names the gateways and the statuses", () => {
		expect(PaymentProviderNameSchema.options).toStrictEqual(["BILLPLZ", "CHIP", "FAKE"]);
		expect(PaymentStatusSchema.options).toStrictEqual(["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]);
	});

	it("takes whole sen between RM 1.00 and RM 100,000.00", () => {
		expect(PaymentAmountMinorSchema.safeParse(PAYMENT_MIN_AMOUNT_MINOR).success).toBe(true);
		expect(PaymentAmountMinorSchema.safeParse(PAYMENT_MAX_AMOUNT_MINOR).success).toBe(true);
		for (const amount of [99, PAYMENT_MAX_AMOUNT_MINOR + 1, 150.5, 0, -100]) {
			expect(PaymentAmountMinorSchema.safeParse(amount).success).toBe(false);
		}
	});
});
