import { describe, expect, it } from "vitest";

import { checkPaymentForm, EMPTY_PAYMENT_FORM, formatPaymentAmount, idempotencyKeyFor, parseAmountToMinor, type PaymentFormValues } from "../payments";

const RETURN = "https://merchant.example.com/t/kl/payments";
const VALID: PaymentFormValues = { provider: "CHIP", amount: "25.50", description: "Order 42", payerName: "Aisyah", payerEmail: " aisyah@example.com " };

describe("parseAmountToMinor", () => {
	it("reads ringgit as typed into sen", () => {
		expect(parseAmountToMinor("25")).toBe(2_500);
		expect(parseAmountToMinor("25.5")).toBe(2_550);
		expect(parseAmountToMinor(" 25.05 ")).toBe(2_505);
		expect(parseAmountToMinor("1,250.00")).toBe(125_000);
	});

	it("refuses anything that isn't an amount", () => {
		for (const text of ["", "abc", "25.505", "-5", "1e3", ".50"]) {
			expect(parseAmountToMinor(text)).toBeNull();
		}
	});
});

describe("formatPaymentAmount", () => {
	it("shows sen as ringgit", () => {
		expect(formatPaymentAmount(2_550, "MYR")).toBe("RM 25.50");
		expect(formatPaymentAmount(125_000, "MYR")).toBe("RM 1,250.00");
	});
});

describe("checkPaymentForm", () => {
	it("builds the API's request from a filled form", () => {
		expect(checkPaymentForm(VALID, RETURN)).toStrictEqual({
			ok: true,
			request: { provider: "CHIP", amountMinor: 2_550, currency: "MYR", description: "Order 42", payerName: "Aisyah", payerEmail: "aisyah@example.com", returnUrl: RETURN },
		});
	});

	it("names every field that is wrong, in the merchant's words", () => {
		const check = checkPaymentForm(EMPTY_PAYMENT_FORM, RETURN);
		expect(check.ok).toBe(false);
		expect(check.ok ? {} : check.errors).toStrictEqual({
			provider: "Choose how the customer pays.",
			amount: "Enter the amount in ringgit, like 25.00.",
			description: "Say what the payment is for (up to 200 characters).",
			payerName: "Enter the customer's name.",
			payerEmail: "Enter the customer's email address; the gateway sends the receipt there.",
		});
	});

	it("tells an amount outside the gateways' range apart from one that isn't a number", () => {
		const check = checkPaymentForm({ ...VALID, amount: "0.50" }, RETURN);
		expect(check.ok ? null : check.errors.amount).toMatch(/^Enter an amount from RM .+ to RM .+\.$/u);
	});
});

describe("idempotencyKeyFor", () => {
	it("keeps the key for the same request and makes a new one once anything changed", () => {
		let made = 0;
		const newKey = (): string => `key-${String((made += 1))}`;
		const check = checkPaymentForm(VALID, RETURN);
		const changed = checkPaymentForm({ ...VALID, amount: "26" }, RETURN);
		if (!check.ok || !changed.ok) {
			throw new Error("fixture must be valid");
		}
		const first = idempotencyKeyFor(null, check.request, newKey);
		expect(first.key).toBe("key-1");
		expect(idempotencyKeyFor(first, check.request, newKey).key).toBe("key-1");
		expect(idempotencyKeyFor(first, changed.request, newKey).key).toBe("key-2");
	});
});
