// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantPaymentsPageView } from "@/contexts/payments/components/merchant-payments-page-view";
import { tenantRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { paymentFixture } from "@/testing/payments";
import { accessibilityViolations } from "@workspace/ui/testing/axe";

const { paymentsQuery } = vi.hoisted(() => ({ paymentsQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenantPayments: { payments: { useQuery: paymentsQuery } } } }),
}));

const META = { correlationId: "c", timestamp: 0, limit: 20, total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };

beforeEach((): void => {
	window.history.replaceState(null, "", `/t/${TEST_ORG_SLUG}/payments`);
	paymentsQuery.mockReturnValue({ data: { data: [paymentFixture({ status: "PAID" })], meta: META }, isPlaceholderData: false, isError: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantPaymentsPageView", () => {
	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		renderWithAuthorization(<MerchantPaymentsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("lists each payment with its amount, customer, gateway and state, linking to it", () => {
		renderWithAuthorization(<MerchantPaymentsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		const link = screen.getByRole("link", { name: /Catering order/u });
		expect(link.getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).payments.detail(paymentFixture().id));
		expect(link.textContent).toContain("RM 25.50");
		expect(link.textContent).toContain("Aisyah, CHIP");
		expect(screen.getByText("Paid", { selector: "[data-slot=badge]" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "New payment" }).getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).payments.new);
	});

	it("invites the first payment when there are none", () => {
		paymentsQuery.mockReturnValue({ data: { data: [], meta: { ...META, total: 0 } }, isPlaceholderData: false, isError: false });
		renderWithAuthorization(<MerchantPaymentsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText("No payments yet")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Ask for your first payment" })).toBeTruthy();
	});

	it("says so when the list can't load, and shows placeholders while it loads", () => {
		paymentsQuery.mockReturnValue({ data: undefined, isPlaceholderData: false, isError: true });
		const { unmount } = renderWithAuthorization(<MerchantPaymentsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
		expect(screen.getByText(/Couldn't load your payments/u)).toBeTruthy();
		unmount();

		paymentsQuery.mockReturnValue({ data: undefined, isPlaceholderData: false, isError: false });
		renderWithAuthorization(<MerchantPaymentsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
		expect(screen.getByLabelText("Loading payments").getAttribute("aria-busy")).toBe("true");
	});
});
