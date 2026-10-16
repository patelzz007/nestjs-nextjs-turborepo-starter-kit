// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { RESET_PASSWORD_FORM_LOADING_LABELS, ResetPasswordFormSkeleton } from "./reset-password-form-skeleton";

/** New password and its confirmation. */
const PASSWORD_FIELDS = 2;

afterEach((): void => {
	cleanup();
});

describe("ResetPasswordFormSkeleton", () => {
	it("announces one busy region saying the link is being checked", (): void => {
		render(<ResetPasswordFormSkeleton />, { wrapper: UiKitTestProviders });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe(RESET_PASSWORD_FORM_LOADING_LABELS.loading);
	});

	it("draws the form's two password fields as a bare form silhouette", (): void => {
		const { container } = render(<ResetPasswordFormSkeleton />, { wrapper: UiKitTestProviders });

		const form = container.querySelector('[data-slot="form-skeleton"]');
		expect(form?.closest('[data-slot="card"]')).toBeNull();
		expect(form?.querySelectorAll(".h-9")).toHaveLength(PASSWORD_FIELDS);
	});
});
