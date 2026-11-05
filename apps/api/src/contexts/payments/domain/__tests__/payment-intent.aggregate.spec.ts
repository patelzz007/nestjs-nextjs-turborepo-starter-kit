import { PaymentStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { PaymentIntent } from "../aggregates/payment-intent.aggregate";
import { PaymentNotRefundableError } from "../errors/payments.errors";
import { isFinalPaymentStatus, paymentStatusChange } from "../policies/payment-status.policy";

const NOW = 1_793_664_000_000;

function intent(): PaymentIntent {
	return PaymentIntent.create(
		{
			id: "pi-1",
			tenantId: "t-1",
			provider: "BILLPLZ",
			amountMinor: 1_500,
			currency: "MYR",
			description: "Order 42",
			payerName: "Aisyah",
			payerEmail: "aisyah@example.com",
			idempotencyKey: "key-1",
		},
		NOW,
	);
}

describe("paymentStatusChange", () => {
	it("moves forward, repeats as no-ops, and ignores news that would move backwards", () => {
		expect(paymentStatusChange("PENDING", "PAID")).toBe("applied");
		expect(paymentStatusChange("FAILED", "PAID")).toBe("applied");
		expect(paymentStatusChange("PAID", "REFUNDED")).toBe("applied");
		expect(paymentStatusChange("PAID", "PAID")).toBe("unchanged");
		expect(paymentStatusChange("PAID", "PENDING")).toBe("ignored");
		expect(paymentStatusChange("PAID", "FAILED")).toBe("ignored");
		expect(paymentStatusChange("CANCELLED", "PAID")).toBe("ignored");
	});

	it("knows the final statuses", () => {
		expect(PaymentStatusSchema.options.filter(isFinalPaymentStatus)).toStrictEqual(["CANCELLED", "REFUNDED"]);
	});
});

describe("PaymentIntent", () => {
	it("starts pending, records its checkout, and stamps the time it was paid once", () => {
		const payment = intent();
		expect(payment.snapshot.status).toBe("PENDING");
		payment.attachCheckout("bill-1", "https://www.billplz.com/bills/bill-1", NOW + 1);
		expect(payment.snapshot).toMatchObject({ providerPaymentId: "bill-1", checkoutUrl: "https://www.billplz.com/bills/bill-1" });
		expect(payment.applyProviderStatus("PAID", NOW + 2)).toBe("applied");
		expect(payment.applyProviderStatus("PAID", NOW + 3)).toBe("unchanged");
		expect(payment.snapshot.paidAt).toBe(NOW + 2);
	});

	it("only refunds a paid payment", () => {
		const payment = intent();
		expect((): void => {
			payment.assertRefundable();
		}).toThrow(PaymentNotRefundableError);
		payment.applyProviderStatus("PAID", NOW);
		expect((): void => {
			payment.assertRefundable();
		}).not.toThrow();
	});
});
