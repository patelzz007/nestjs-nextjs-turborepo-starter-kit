// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OwnProfileEditableFields } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileForm } from "../profile-form";

function renderForm(overrides: Partial<React.ComponentProps<typeof ProfileForm>> = {}): ReturnType<typeof vi.fn<(values: OwnProfileEditableFields) => void>> {
	const onSubmit = vi.fn<(values: OwnProfileEditableFields) => void>();
	render(<ProfileForm initialValues={{ fullName: "Regular User" }} isPending={false} isReadOnly={false} onSubmit={onSubmit} {...overrides} />);
	return onSubmit;
}

function nameInput(): HTMLInputElement {
	const input = screen.getByLabelText("Full name");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("Full name is not an input");
	}
	return input;
}

describe("ProfileForm", () => {
	afterEach(() => {
		cleanup();
	});

	it("shows the current name", () => {
		renderForm();

		expect(nameInput().value).toBe("Regular User");
	});

	it("submits the value parsed by the shared schema (trimmed)", async () => {
		const onSubmit = renderForm();

		fireEvent.change(nameInput(), { target: { value: "  Jane Doe  " } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith({ fullName: "Jane Doe" });
		});
	});

	it("shows the shared rule's message and does not submit a blank name", async () => {
		const onSubmit = renderForm();

		fireEvent.change(nameInput(), { target: { value: "   " } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		expect(await screen.findByText("Full name must be at least 2 characters")).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("is read-only when asked (impersonation): the field and the button are disabled", () => {
		renderForm({ isReadOnly: true });

		expect(nameInput().matches(":disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
	});

	it("disables saving while a save is in flight", () => {
		renderForm({ isPending: true });

		expect(screen.getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true);
	});
});
