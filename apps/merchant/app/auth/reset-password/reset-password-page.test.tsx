// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MerchantResetPasswordPage from "@/app/auth/reset-password/page";

let token: string | null = null;

vi.mock("next/navigation", () => ({
	useSearchParams: (): { readonly get: (key: string) => string | null } => ({ get: (key: string): string | null => (key === "token" ? token : null) }),
}));

/** The real form talks to the API; here only which branch renders matters. */
vi.mock("@workspace/client/lib/auth/forms/reset-password-form", () => ({
	ResetPasswordForm: ({ token: value, forgotPasswordHref }: { readonly token: string; readonly forgotPasswordHref?: string }): React.JSX.Element => (
		<p>
			form:{value}:{forgotPasswordHref}
		</p>
	),
}));

afterEach(() => {
	cleanup();
	token = null;
});

describe("MerchantResetPasswordPage", () => {
	it("renders the reset form for the emailed token, linking back to merchant's forgot-password page", () => {
		token = "reset-token-123";
		render(<MerchantResetPasswordPage />);

		expect(screen.getByText("form:reset-token-123:/auth/forgot-password")).toBeDefined();
	});

	it.each([null, "   "])("explains a missing or blank token (%s) instead of rendering the form", (value: string | null) => {
		token = value;
		render(<MerchantResetPasswordPage />);

		expect(screen.getByRole("alert").textContent).toContain("This reset link is invalid");
		expect(screen.queryByText(/^form:/u)).toBeNull();
	});
});
