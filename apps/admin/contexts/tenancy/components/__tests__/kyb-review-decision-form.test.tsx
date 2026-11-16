// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import type { KybStatus } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KybReviewDecisionForm, kybStatusOptionsFrom } from "../kyb-review-decision-form";

function renderForm(kybStatus: KybStatus): void {
	render(<KybReviewDecisionForm kybStatus={kybStatus} kybFields={null} isSaving={false} onSubmitReview={vi.fn()} />, { wrapper: ClientTestProviders });
}

function isDisabled(name: string): boolean {
	return screen.getByRole("button", { name }).hasAttribute("disabled");
}

afterEach(() => {
	cleanup();
});

describe("kybStatusOptionsFrom", () => {
	it("offers the current status and the decisions the shared KYB table allows from it", () => {
		expect(kybStatusOptionsFrom("PENDING")).toEqual(["PENDING", "APPROVED", "REJECTED", "ACTION_REQUIRED"]);
		expect(kybStatusOptionsFrom("ACTION_REQUIRED")).toEqual(["APPROVED", "REJECTED", "ACTION_REQUIRED"]);
		expect(kybStatusOptionsFrom("APPROVED")).toEqual(["APPROVED", "REJECTED", "ACTION_REQUIRED"]);
		expect(kybStatusOptionsFrom("REJECTED")).toEqual(["REJECTED"]);
	});
});

describe("KybReviewDecisionForm", () => {
	it("offers Approve and Reject on a pending review", () => {
		renderForm("PENDING");
		expect(isDisabled("Approve")).toBe(false);
		expect(isDisabled("Reject")).toBe(false);
		expect(screen.queryByText(/This review is closed/)).toBeNull();
	});

	it("does not offer approving an approved review again", () => {
		renderForm("APPROVED");
		expect(isDisabled("Approve")).toBe(true);
		expect(isDisabled("Reject")).toBe(false);
	});

	it("explains that a rejected review reopens only when the merchant resubmits", () => {
		renderForm("REJECTED");
		expect(isDisabled("Approve")).toBe(true);
		expect(isDisabled("Reject")).toBe(true);
		expect(screen.getByText("This review is closed: it reopens when the merchant submits their details again.")).toBeDefined();
	});
});
