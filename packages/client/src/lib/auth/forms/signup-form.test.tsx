// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Envelope, SignupInput, SignupResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { SignupForm } from "./signup-form";

const mocks = vi.hoisted(() => ({
	signup: vi.fn<(input: SignupInput) => Promise<Envelope<SignupResponse>>>(),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			signup: {
				useMutation: (): { readonly mutateAsync: typeof mocks.signup; readonly isPending: boolean } => ({ mutateAsync: mocks.signup, isPending: false }),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
	};
});

const SUCCESS_TEXT = "Account created. Check your email for a verification link before signing in.";
const VALID: SignupInput = { fullName: "Jane Doe", email: "jane@example.com", password: "StrongP@ss1" };

function submitSignup(values: SignupInput): void {
	fireEvent.change(screen.getByLabelText("Full name"), { target: { value: values.fullName } });
	fireEvent.change(screen.getByLabelText("Email"), { target: { value: values.email } });
	const passwordInput = screen.getByLabelText("Password");
	fireEvent.change(passwordInput, { target: { value: values.password } });
	// Submit the form directly: the shared zod schema — not the browser's constraint validation — is under test.
	const form = passwordInput.closest("form");
	if (form === null) throw new Error("password input is not inside a form");
	fireEvent.submit(form);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

describe("SignupForm validation", () => {
	it("rejects an invalid email", async () => {
		render(<SignupForm />);

		submitSignup({ ...VALID, email: "jane-at-example" });

		expect(await screen.findByText("Invalid email address")).toBeDefined();
		expect(mocks.signup).not.toHaveBeenCalled();
	});

	it("rejects a weak password with the shared strong-password rule", async () => {
		render(<SignupForm />);

		submitSignup({ ...VALID, password: "short" });

		expect(await screen.findByText("Password must be at least 8 characters")).toBeDefined();
		expect(mocks.signup).not.toHaveBeenCalled();
	});

	it("rejects a password without a special character", async () => {
		render(<SignupForm />);

		submitSignup({ ...VALID, password: "StrongPass1" });

		expect(await screen.findByText("Password must contain at least one special character")).toBeDefined();
		expect(mocks.signup).not.toHaveBeenCalled();
	});

	it("rejects a one-character full name", async () => {
		render(<SignupForm />);

		submitSignup({ ...VALID, fullName: "J" });

		expect(await screen.findByText("Full name must be at least 2 characters")).toBeDefined();
		expect(mocks.signup).not.toHaveBeenCalled();
	});
});

describe("SignupForm submit", () => {
	it("creates the account with the validated details and shows the check-your-email message", async () => {
		mocks.signup.mockResolvedValue(envelopeFixture({ message: "Account created" }));
		render(<SignupForm loginHref="/sign-in" />);

		submitSignup(VALID);

		expect(await screen.findByText(SUCCESS_TEXT)).toBeDefined();
		expect(mocks.signup).toHaveBeenCalledWith(VALID);
		expect(screen.queryByLabelText("Full name")).toBeNull();
		expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/sign-in");
	});

	it("shows the API error and keeps the form when signup fails", async () => {
		mocks.signup.mockRejectedValue(new ApiError({ message: "An account with this email already exists", statusCode: 409 }));
		render(<SignupForm />);

		submitSignup(VALID);

		expect(await screen.findByText("An account with this email already exists")).toBeDefined();
		expect(screen.queryByText(SUCCESS_TEXT)).toBeNull();
		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Create account" })).toBeDefined();
		});
	});

	it("links to sign-in from the form", () => {
		render(<SignupForm />);

		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login");
	});
});
