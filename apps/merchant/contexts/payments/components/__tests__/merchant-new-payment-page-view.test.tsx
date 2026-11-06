// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { IDEMPOTENCY_KEY_HEADER, type CreatePaymentIntent, type PaymentIntentResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantNewPaymentPageView } from "@/contexts/payments/components/merchant-new-payment-page-view";
import { tenantRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { paymentFixture } from "@/testing/payments";
import { accessibilityViolations } from "@workspace/ui/testing/axe";

interface CreateCallOptions {
	readonly headers: Readonly<Record<string, string>>;
}

const { providersQuery, createMutate, routerPush } = vi.hoisted(() => ({
	providersQuery: vi.fn(),
	createMutate: vi.fn<(input: CreatePaymentIntent & { readonly tenantSlug: string }, options: CreateCallOptions) => Promise<{ readonly data: PaymentIntentResponse }>>(),
	routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push: routerPush, refresh: vi.fn() }),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenantPayments: { providers: { useQuery: providersQuery }, createPayment: { mutate: createMutate } } } }),
}));

function providersReturn(names: readonly ("BILLPLZ" | "CHIP")[]): void {
	providersQuery.mockReturnValue({ data: { data: { providers: names.map((name) => ({ name, refunds: name === "CHIP" })) } }, isError: false, error: null });
}

function fill(label: string, value: string): void {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function renderPage(): void {
	renderWithAuthorization(<MerchantNewPaymentPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
}

beforeEach((): void => {
	window.history.replaceState(null, "", `/t/${TEST_ORG_SLUG}/payments/new`);
	providersReturn(["CHIP"]);
	createMutate.mockResolvedValue({ data: paymentFixture() });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantNewPaymentPageView", () => {
	it("has no serious accessibility problems, before and after the errors show (enhancement 3.2)", async () => {
		providersReturn(["BILLPLZ", "CHIP"]);
		renderPage();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
		fireEvent.click(screen.getByRole("button", { name: "Create payment" }));
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("sends the request with an Idempotency-Key and opens the new payment", async () => {
		renderPage();
		fill("Amount", "25.50");
		fill("What it's for", "Catering order");
		fill("Customer's name", "Aisyah");
		fill("Customer's email", "aisyah@example.com");
		fireEvent.click(screen.getByRole("button", { name: "Create payment" }));

		await waitFor((): void => {
			expect(routerPush).toHaveBeenCalledWith(tenantRoutes(TEST_ORG_SLUG).payments.detail(paymentFixture().id));
		});
		const [[input, options] = []] = createMutate.mock.calls;
		expect(input).toStrictEqual({
			tenantSlug: TEST_ORG_SLUG,
			provider: "CHIP",
			amountMinor: 2_550,
			currency: "MYR",
			description: "Catering order",
			payerName: "Aisyah",
			payerEmail: "aisyah@example.com",
			returnUrl: `${window.location.origin}${tenantRoutes(TEST_ORG_SLUG).payments.list}`,
		});
		expect(options?.headers[IDEMPOTENCY_KEY_HEADER]).toMatch(/^[\w-]{8,}$/u);
	});

	it("resends the same key for the same details after a failure, so a lost answer never pays twice", async () => {
		createMutate.mockRejectedValueOnce(new Error("offline"));
		renderPage();
		fill("Amount", "10");
		fill("What it's for", "Deposit");
		fill("Customer's name", "Aisyah");
		fill("Customer's email", "aisyah@example.com");
		fireEvent.click(screen.getByRole("button", { name: "Create payment" }));
		await waitFor((): void => {
			expect(screen.getByRole("alert").textContent).toBeTruthy();
		});
		fireEvent.click(screen.getByRole("button", { name: "Create payment" }));
		await waitFor((): void => {
			expect(createMutate).toHaveBeenCalledTimes(2);
		});
		const [[, firstOptions] = [], [, secondOptions] = []] = createMutate.mock.calls;
		expect(secondOptions?.headers[IDEMPOTENCY_KEY_HEADER]).toBe(firstOptions?.headers[IDEMPOTENCY_KEY_HEADER]);
		expect(firstOptions?.headers[IDEMPOTENCY_KEY_HEADER]).toMatch(/^[\w-]{8,}$/u);
	});

	it("says what is missing instead of sending an incomplete request", () => {
		providersReturn(["BILLPLZ", "CHIP"]);
		renderPage();
		fireEvent.click(screen.getByRole("button", { name: "Create payment" }));

		expect(screen.getByText("Choose how the customer pays.")).toBeTruthy();
		expect(screen.getByText("Enter the amount in ringgit, like 25.00.")).toBeTruthy();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("offers only the gateways set up here, and says when none is", () => {
		providersReturn(["BILLPLZ", "CHIP"]);
		const { unmount } = renderWithAuthorization(<MerchantNewPaymentPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
		expect(screen.getAllByRole("radio")).toHaveLength(2);
		unmount();

		providersReturn([]);
		renderPage();
		expect(screen.getByText("Payments aren't set up yet")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Create payment" })).toBeNull();
	});
});
