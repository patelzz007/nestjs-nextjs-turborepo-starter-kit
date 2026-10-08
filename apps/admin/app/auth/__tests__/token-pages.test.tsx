// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminForgotPasswordPage from "../forgot-password/page";
import AdminResetPasswordPage from "../reset-password/page";
import AdminVerifyEmailPage from "../verify-email/page";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const { resetPasswordForm, verifyEmailView } = vi.hoisted(() => ({
	resetPasswordForm: vi.fn<(props: { readonly token: string }) => null>(() => null),
	verifyEmailView: vi.fn<(props: { readonly token: string }) => null>(() => null),
}));

// The token forms are probes: this suite checks what the server pages hand them.
vi.mock("@workspace/client/lib/auth/forms/reset-password-form", () => ({ ResetPasswordForm: resetPasswordForm }));
vi.mock("@workspace/client/lib/auth/email/verify-email-view", () => ({ VerifyEmailView: verifyEmailView }));
vi.mock("@workspace/client/lib/auth/forms/forgot-password-form", () => ({ ForgotPasswordForm: (): null => null }));
vi.mock("next-themes", () => ({ useTheme: (): { readonly resolvedTheme: string; readonly setTheme: () => void } => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("token auth pages", () => {
	it("binds the reset form to the emailed token", async () => {
		render(await AdminResetPasswordPage({ searchParams: Promise.resolve({ token: "reset-token" }) }), { wrapper: UiKitTestProviders });
		expect(resetPasswordForm.mock.lastCall?.[LIST_SLOT_INDEX.first].token).toBe("reset-token");
	});

	it("shows the invalid-link notice for a reset link without a token", async () => {
		render(await AdminResetPasswordPage({ searchParams: Promise.resolve({}) }), { wrapper: UiKitTestProviders });
		expect(resetPasswordForm).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toContain("This reset link is invalid");
	});

	it("binds the verify view to the emailed token and states the shared link lifetime", async () => {
		render(await AdminVerifyEmailPage({ searchParams: Promise.resolve({ token: "verify-token" }) }), { wrapper: UiKitTestProviders });
		expect(verifyEmailView.mock.lastCall?.[LIST_SLOT_INDEX.first].token).toBe("verify-token");
		expect(screen.getByText("Expires after 24 hours")).toBeDefined();
	});

	it("shows the invalid-link notice for a verify link with a repeated token", async () => {
		render(await AdminVerifyEmailPage({ searchParams: Promise.resolve({ token: ["a", "b"] }) }), { wrapper: UiKitTestProviders });
		expect(verifyEmailView).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toContain("This verification link is invalid");
	});

	it("states the shared reset-link lifetime on the forgot-password page", () => {
		render(AdminForgotPasswordPage(), { wrapper: UiKitTestProviders });
		expect(screen.getByText("Links expire after 1 hour")).toBeDefined();
	});
});
