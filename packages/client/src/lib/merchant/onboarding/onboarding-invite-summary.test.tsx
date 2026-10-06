// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantOnboardingInviteSummary, MerchantOnboardingSkeleton } from "./onboarding-invite-summary";

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

describe("MerchantOnboardingSkeleton", () => {
	it("announces the loading state", (): void => {
		render(<MerchantOnboardingSkeleton stepCount={4} />);
		expect(screen.getByRole("status").textContent).toContain("Verifying your invite");
	});

	it("draws one placeholder timeline row per step", (): void => {
		const stepCount = 4;
		const { container } = render(<MerchantOnboardingSkeleton stepCount={stepCount} />);
		expect(container.querySelectorAll('[data-slot="skeleton"].rounded-full')).toHaveLength(stepCount);
	});
});
