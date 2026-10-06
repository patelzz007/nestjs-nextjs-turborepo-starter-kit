// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { APP_LINKS, type Envelope, type MessageResponse, type ResetPasswordInput, type ValidateResetTokenInput, type ValidateResetTokenResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { ResetPasswordForm } from "./reset-password-form";

const mocks = vi.hoisted(() => ({
	resetPassword: vi.fn<(input: ResetPasswordInput) => Promise<Envelope<MessageResponse>>>(),
	validateResetToken: vi.fn<(input: ValidateResetTokenInput) => Promise<Envelope<ValidateResetTokenResponse>>>(),
	push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: (href: string) => void } => ({ push: mocks.push }),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			resetPassword: {
				useMutation: (): { readonly mutateAsync: typeof mocks.resetPassword; readonly isPending: boolean } => ({ mutateAsync: mocks.resetPassword, isPending: false }),
			},
			validateResetToken: {
				useMutation: (): { readonly mutateAsync: typeof mocks.validateResetToken; readonly isPending: boolean } => ({
					mutateAsync: mocks.validateResetToken,
					isPending: false,
				}),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
	};
});

const TOKEN = "reset-token-1";
const STRONG_PASSWORD = "NewSecure@456";
const INVALID_LINK_TEXT = "This password reset link is invalid or has expired.";

async function renderValidForm(loginHref: string = APP_LINKS.auth.login): Promise<void> {
	mocks.validateResetToken.mockResolvedValue(envelopeFixture({ valid: true }));
	render(<ResetPasswordForm token={TOKEN} loginHref={loginHref} />, { wrapper: UiKitTestProviders });
	await screen.findByLabelText("New password");
}

function submitPasswords(password: string, confirmPassword: string): void {
	fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
	const confirmInput = screen.getByLabelText("Confirm password");
	fireEvent.change(confirmInput, { target: { value: confirmPassword } });
	// Submit the form directly: the shared zod schema — not the browser's constraint validation — is under test.
	const form = confirmInput.closest("form");
	if (form === null) throw new Error("confirm input is not inside a form");
	fireEvent.submit(form);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

describe("ResetPasswordForm token validation", () => {
	it("shows the invalid-link state for an empty token without asking the API", () => {
		render(<ResetPasswordForm token="" />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(INVALID_LINK_TEXT)).toBeDefined();
		expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe(APP_LINKS.auth.forgotPassword);
		expect(mocks.validateResetToken).not.toHaveBeenCalled();
	});

	it("validates the token, showing a pending state until the API answers", async () => {
		mocks.validateResetToken.mockResolvedValue(envelopeFixture({ valid: true }));
		render(<ResetPasswordForm token={TOKEN} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Validating reset link...")).toBeDefined();
		expect(await screen.findByLabelText("New password")).toBeDefined();
		expect(mocks.validateResetToken).toHaveBeenCalledWith({ token: TOKEN });
	});

	it("shows the invalid-link state when the API says the token is not valid", async () => {
		mocks.validateResetToken.mockResolvedValue(envelopeFixture({ valid: false }));
		render(<ResetPasswordForm token={TOKEN} forgotPasswordHref="/help/reset" />, { wrapper: UiKitTestProviders });

		expect(await screen.findByText(INVALID_LINK_TEXT)).toBeDefined();
		expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe("/help/reset");
		expect(screen.queryByLabelText("New password")).toBeNull();
	});

	it("treats a failed token check as an invalid link", async () => {
		mocks.validateResetToken.mockRejectedValue(new ApiError({ message: "Server error", statusCode: 500 }));
		render(<ResetPasswordForm token={TOKEN} />, { wrapper: UiKitTestProviders });

		expect(await screen.findByText(INVALID_LINK_TEXT)).toBeDefined();
	});
});

describe("ResetPasswordForm submit", () => {
	it("rejects a weak password with the shared strong-password rule", async () => {
		await renderValidForm();

		submitPasswords("weak", "weak");

		expect(await screen.findByText("Password must be at least 8 characters")).toBeDefined();
		expect(mocks.resetPassword).not.toHaveBeenCalled();
	});

	it("rejects a confirmation that does not match", async () => {
		await renderValidForm();

		submitPasswords(STRONG_PASSWORD, "NewSecure@457");

		expect(await screen.findByText("Passwords do not match")).toBeDefined();
		expect(mocks.resetPassword).not.toHaveBeenCalled();
	});

	it("resets the password with the token and navigates to sign-in", async () => {
		mocks.resetPassword.mockResolvedValue(envelopeFixture({ message: "Password reset" }));
		await renderValidForm("/sign-in");

		submitPasswords(STRONG_PASSWORD, STRONG_PASSWORD);

		await vi.waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/sign-in");
		});
		expect(mocks.resetPassword).toHaveBeenCalledWith({ token: TOKEN, password: STRONG_PASSWORD });
	});

	it("shows the API error and does not navigate when the reset fails", async () => {
		mocks.resetPassword.mockRejectedValue(new ApiError({ message: "Reset token has expired", statusCode: 400 }));
		await renderValidForm();

		submitPasswords(STRONG_PASSWORD, STRONG_PASSWORD);

		expect(await screen.findByText("Reset token has expired")).toBeDefined();
		expect(mocks.push).not.toHaveBeenCalled();
	});
});
