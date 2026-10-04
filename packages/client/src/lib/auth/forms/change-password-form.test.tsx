// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChangePasswordInput, ChangePasswordResponse, Envelope } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { ChangePasswordForm } from "./change-password-form";

const mocks = vi.hoisted(() => ({
	changePassword: vi.fn<(input: ChangePasswordInput) => Promise<Envelope<ChangePasswordResponse>>>(),
	onSuccess: vi.fn<() => void>(),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			changePassword: {
				useMutation: (): { readonly mutateAsync: typeof mocks.changePassword; readonly isPending: boolean } => ({ mutateAsync: mocks.changePassword, isPending: false }),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
	};
});

const VALID: ChangePasswordInput = { currentPassword: "OldSecure@123", newPassword: "NewSecure@456", confirmPassword: "NewSecure@456" };

function fieldValue(label: string): string {
	const input = screen.getByLabelText<HTMLInputElement>(label);
	return input.value;
}

function submitChange(values: ChangePasswordInput): void {
	fireEvent.change(screen.getByLabelText("Current password"), { target: { value: values.currentPassword } });
	fireEvent.change(screen.getByLabelText("New password"), { target: { value: values.newPassword } });
	const confirmInput = screen.getByLabelText("Confirm new password");
	fireEvent.change(confirmInput, { target: { value: values.confirmPassword } });
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

describe("ChangePasswordForm validation", () => {
	it("requires the current password", async () => {
		render(<ChangePasswordForm />);

		submitChange({ ...VALID, currentPassword: "" });

		expect(await screen.findByText("Current password is required")).toBeDefined();
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});

	it("rejects a weak new password with the shared strong-password rule", async () => {
		render(<ChangePasswordForm />);

		submitChange({ ...VALID, newPassword: "newsecure@456", confirmPassword: "newsecure@456" });

		expect(await screen.findByText("Password must contain at least one uppercase letter")).toBeDefined();
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});

	it("rejects a confirmation that does not match", async () => {
		render(<ChangePasswordForm />);

		submitChange({ ...VALID, confirmPassword: "NewSecure@457" });

		expect(await screen.findByText("Passwords do not match")).toBeDefined();
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});

	it("rejects a new password equal to the current one", async () => {
		render(<ChangePasswordForm />);

		submitChange({ currentPassword: "SameSecure@1", newPassword: "SameSecure@1", confirmPassword: "SameSecure@1" });

		expect(await screen.findByText("New password must be different from current password")).toBeDefined();
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});
});

describe("ChangePasswordForm submit", () => {
	it("changes the password, shows the API's message, clears the fields and reports success", async () => {
		mocks.changePassword.mockResolvedValue(envelopeFixture({ message: "Password changed. Other sessions were signed out." }));
		render(<ChangePasswordForm onSuccess={mocks.onSuccess} />);

		submitChange(VALID);

		expect(await screen.findByText("Password changed. Other sessions were signed out.")).toBeDefined();
		expect(mocks.changePassword).toHaveBeenCalledWith(VALID);
		expect(mocks.onSuccess).toHaveBeenCalledTimes(1);
		expect(fieldValue("Current password")).toBe("");
		expect(fieldValue("New password")).toBe("");
		expect(fieldValue("Confirm new password")).toBe("");
	});

	it("shows the friendly message of a rejected current password and does not report success", async () => {
		mocks.changePassword.mockRejectedValue(new ApiError({ message: "Invalid credentials", error: "INVALID_CREDENTIALS", statusCode: 401 }));
		render(<ChangePasswordForm onSuccess={mocks.onSuccess} />);

		submitChange(VALID);

		expect(await screen.findByText("Incorrect email or password. Please try again.")).toBeDefined();
		expect(mocks.onSuccess).not.toHaveBeenCalled();
		expect(fieldValue("Current password")).toBe(VALID.currentPassword);
	});
});
