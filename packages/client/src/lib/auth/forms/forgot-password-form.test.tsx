// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { APP_LINKS, type Envelope, type ForgotPasswordInput, type MessageResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { ForgotPasswordForm } from "./forgot-password-form";

const mocks = vi.hoisted(() => ({
	forgotPassword: vi.fn<(input: ForgotPasswordInput) => Promise<Envelope<MessageResponse>>>(),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			forgotPassword: {
				useMutation: (): { readonly mutateAsync: typeof mocks.forgotPassword; readonly isPending: boolean } => ({ mutateAsync: mocks.forgotPassword, isPending: false }),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
	};
});

const SUCCESS_TEXT = "If an account exists with this email, we've sent a password reset link. The link expires in 1 hour.";

function submitEmail(email: string): void {
	const emailInput = screen.getByLabelText("Email");
	fireEvent.change(emailInput, { target: { value: email } });
	// Submit the form directly: the shared zod schema — not the browser's constraint validation — is under test.
	const form = emailInput.closest("form");
	if (form === null) throw new Error("email input is not inside a form");
	fireEvent.submit(form);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

describe("ForgotPasswordForm", () => {
	it("rejects an invalid email with the shared schema's message and never calls the API", async () => {
		render(<ForgotPasswordForm />);

		submitEmail("not-an-email");

		expect(await screen.findByText("Invalid email address")).toBeDefined();
		expect(mocks.forgotPassword).not.toHaveBeenCalled();
	});

	it("sends the email to the forgot-password mutation and shows the neutral confirmation", async () => {
		mocks.forgotPassword.mockResolvedValue(envelopeFixture({ message: "ok" }));
		render(<ForgotPasswordForm />);

		submitEmail("member@example.com");

		expect(await screen.findByText(SUCCESS_TEXT)).toBeDefined();
		expect(mocks.forgotPassword).toHaveBeenCalledWith({ email: "member@example.com" });
		expect(screen.queryByLabelText("Email")).toBeNull();
		expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(APP_LINKS.auth.login);
	});

	it("links back to the given sign-in page after submitting", async () => {
		mocks.forgotPassword.mockResolvedValue(envelopeFixture({ message: "ok" }));
		render(<ForgotPasswordForm loginHref="/merchant/login" />);

		submitEmail("member@example.com");

		expect((await screen.findByRole("link", { name: "Back to sign in" })).getAttribute("href")).toBe("/merchant/login");
	});

	it("shows the API error and keeps the form when the request fails", async () => {
		mocks.forgotPassword.mockRejectedValue(new ApiError({ message: "Too many requests. Try again later.", statusCode: 429 }));
		render(<ForgotPasswordForm />);

		submitEmail("member@example.com");

		expect(await screen.findByText("Too many requests. Try again later.")).toBeDefined();
		expect(screen.queryByText(SUCCESS_TEXT)).toBeNull();
		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Send reset link" })).toBeDefined();
		});
	});

	it("links to sign-in from the form", () => {
		render(<ForgotPasswordForm />);

		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(APP_LINKS.auth.login);
	});
});
