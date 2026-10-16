// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { MERCHANT_ONBOARDING_LOADING_LABELS, MerchantOnboardingInviteSummary, MerchantOnboardingSkeleton } from "./onboarding-invite-summary";

afterEach((): void => {
	cleanup();
});

describe("MerchantOnboardingInviteSummary", () => {
	it("shows the business as a heading and each invite detail under its label", (): void => {
		render(<MerchantOnboardingInviteSummary businessName="Kopi Corner" email="owner@kopi.test" city="Kuala Lumpur" expiresOn="12 Oct 2026" />);
		expect(screen.getByRole("heading", { name: "Kopi Corner" })).toBeTruthy();
		const terms = screen.getAllByRole("term").map((term) => term.textContent);
		const definitions = screen.getAllByRole("definition").map((definition) => definition.textContent);
		expect(terms).toEqual(["Work email", "Pilot city", "Invite expires"]);
		expect(definitions).toEqual(["owner@kopi.test", "Kuala Lumpur", "12 Oct 2026"]);
	});

	it("keeps the business mark decorative so the name is not announced twice", (): void => {
		const { container } = render(<MerchantOnboardingInviteSummary businessName="Kopi Corner" email="owner@kopi.test" city="Kuala Lumpur" expiresOn="12 Oct 2026" />);
		expect(container.querySelector('[data-slot="entity-avatar"]')?.getAttribute("aria-hidden")).toBe("true");
	});
});

/** A wizard of four steps (business, stores, registration, documents). */
const STEP_COUNT = 4;

describe("MerchantOnboardingSkeleton", () => {
	it("announces one busy loading region naming what is verified", (): void => {
		render(<MerchantOnboardingSkeleton stepCount={STEP_COUNT} />, { wrapper: UiKitTestProviders });

		const [status, ...others] = screen.getAllByRole("status");
		expect(others).toHaveLength(0);
		expect(status?.getAttribute("aria-busy")).toBe("true");
		expect(status?.textContent).toBe(MERCHANT_ONBOARDING_LOADING_LABELS.loading);
	});

	it("draws one placeholder timeline row per step", (): void => {
		const { container } = render(<MerchantOnboardingSkeleton stepCount={STEP_COUNT} />, { wrapper: UiKitTestProviders });
		expect(container.querySelectorAll('[data-slot="onboarding-step-skeleton"]')).toHaveLength(STEP_COUNT);
	});

	it("keeps the placeholder bones out of the accessibility tree", (): void => {
		const { container } = render(<MerchantOnboardingSkeleton stepCount={STEP_COUNT} />, { wrapper: UiKitTestProviders });
		const bone = container.querySelector('[data-slot="skeleton"]');
		expect(bone?.closest('[aria-hidden="true"]')).not.toBeNull();
	});
});
