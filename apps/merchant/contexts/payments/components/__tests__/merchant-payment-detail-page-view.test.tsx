// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { epochMs, type PaymentIntentResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { describePaymentNextStep, MerchantPaymentDetailPageView } from "@/contexts/payments/components/merchant-payment-detail-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { paymentFixture } from "@/testing/payments";
import { accessibilityViolations } from "@workspace/ui/testing/axe";

const { paymentQuery, refundMutate } = vi.hoisted(() => ({ paymentQuery: vi.fn(), refundMutate: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: { tenantPayments: { payment: { useQuery: paymentQuery }, refundPayment: { useMutation: (): object => ({ mutate: refundMutate, isPending: false, error: null }) } } },
	}),
}));

function renderPayment(payment: PaymentIntentResponse): void {
	paymentQuery.mockReturnValue({ data: { data: payment }, isError: false, error: null });
	renderWithAuthorization(<MerchantPaymentDetailPageView tenantSlug={TEST_ORG_SLUG} paymentId={payment.id} />, { role: "OWNER" });
}

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantPaymentDetailPageView", () => {
	it("has no serious accessibility problems, waiting and paid (enhancement 3.2)", async () => {
		renderPayment(paymentFixture());
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
		cleanup();
		renderPayment(paymentFixture({ status: "PAID", refundable: true, checkoutUrl: null }));
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("shows a waiting payment's amount and checkout link, without a refund", () => {
		renderPayment(paymentFixture());

		expect(screen.getByRole("heading", { level: 1, name: "RM 25.50" })).toBeTruthy();
		const checkout = within(screen.getByRole("region", { name: "Checkout link" }));
		expect(checkout.getByRole("link", { name: "Open checkout" }).getAttribute("href")).toBe("https://gate.chip-in.asia/p/abc123/");
		expect(screen.queryByRole("button", { name: "Refund" })).toBeNull();
	});

	it("refunds a paid payment only after the merchant confirms", () => {
		renderPayment(paymentFixture({ status: "PAID", refundable: true, checkoutUrl: null, paidAt: epochMs(Date.UTC(2026, 10, 3, 2, 5)) }));

		expect(screen.queryByRole("region", { name: "Checkout link" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Refund" }));
		expect(refundMutate).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Refund payment" }));
		expect(refundMutate).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, paymentId: paymentFixture().id });
	});

	it("says where a Billplz payment is refunded", () => {
		renderPayment(paymentFixture({ provider: "BILLPLZ", status: "PAID", refundable: false, checkoutUrl: null }));

		expect(screen.queryByRole("button", { name: "Refund" })).toBeNull();
		expect(within(screen.getByRole("region", { name: "Details" })).getByText("In the Billplz dashboard")).toBeTruthy();
	});
});

describe("describePaymentNextStep", () => {
	it("tells the merchant what to do in every state", () => {
		expect(describePaymentNextStep(paymentFixture())).toMatch(/^Send the customer the checkout link/u);
		expect(describePaymentNextStep(paymentFixture({ status: "PAID", refundable: true }))).toBe("Paid. You can refund it in full here.");
		expect(describePaymentNextStep(paymentFixture({ status: "PAID", provider: "BILLPLZ" }))).toMatch(/Billplz payments are made in its own dashboard\.$/u);
		expect(describePaymentNextStep(paymentFixture({ status: "FAILED" }))).toMatch(/^The payment didn't go through/u);
		expect(describePaymentNextStep(paymentFixture({ status: "CANCELLED" }))).toMatch(/^This payment was closed/u);
		expect(describePaymentNextStep(paymentFixture({ status: "REFUNDED" }))).toMatch(/^Refunded in full/u);
	});
});
