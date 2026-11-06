import { epochMs, type PaymentIntentResponse } from "@workspace/shared";

/** A payment as the API returns it: waiting for a CHIP checkout, unless `overrides` say otherwise. */
export function paymentFixture(overrides: Partial<PaymentIntentResponse> = {}): PaymentIntentResponse {
	return {
		id: "0193f2c4-0000-7000-8000-00000000a001",
		tenantId: "0193f2c4-0000-7000-8000-0000000000a1",
		provider: "CHIP",
		status: "PENDING",
		amountMinor: 2_550,
		currency: "MYR",
		description: "Catering order",
		payerName: "Aisyah",
		payerEmail: "aisyah@example.com",
		checkoutUrl: "https://gate.chip-in.asia/p/abc123/",
		providerPaymentId: "abc123",
		paidAt: null,
		refundable: false,
		createdAt: epochMs(Date.UTC(2026, 10, 3, 2, 0)),
		updatedAt: epochMs(Date.UTC(2026, 10, 3, 2, 0)),
		isDeleted: false,
		deletedAt: null,
		...overrides,
	};
}
