// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerPicker, type CustomerPickerOption, type CustomerPickerProps } from "@/components/merchant-ui/customer-picker";

const ALICE: CustomerPickerOption = { userId: "a1", fullName: "Alice Johnson", maskedEmail: "a•••@example.com", detail: "Claimed once", unavailableReason: null };
const BOB: CustomerPickerOption = { userId: "b2", fullName: "Bob Smith", maskedEmail: null, detail: "Claimed 3 times", unavailableReason: null };
const CAROL: CustomerPickerOption = { userId: "c3", fullName: "Carol Tan", maskedEmail: "c•••@example.com", detail: "", unavailableReason: "Opted out" };

function renderPicker(overrides: Partial<CustomerPickerProps> = {}): CustomerPickerProps {
	const props: CustomerPickerProps = {
		id: "picker",
		search: "",
		onSearchChange: vi.fn<(search: string) => void>(),
		options: [ALICE, BOB, CAROL],
		selected: [],
		onAdd: vi.fn<(option: CustomerPickerOption) => void>(),
		onRemove: vi.fn<(userId: string) => void>(),
		isLoading: false,
		isError: false,
		max: 2,
		...overrides,
	};
	render(<CustomerPicker {...props} />, { wrapper: UiKitTestProviders });
	return props;
}

afterEach((): void => {
	cleanup();
});

describe("CustomerPicker", () => {
	it("shows each customer's name and masked email, never more", (): void => {
		renderPicker();
		expect(screen.getByText("Alice Johnson")).toBeTruthy();
		expect(screen.getByText("a•••@example.com · Claimed once")).toBeTruthy();
		expect(screen.getByText("Claimed 3 times")).toBeTruthy();
	});

	it("adds a customer when ticked and removes them when unticked", (): void => {
		const props = renderPicker({ selected: [BOB] });
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Alice Johnson/u }));
		});
		expect(props.onAdd).toHaveBeenCalledWith(ALICE);
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Bob Smith/u }));
		});
		expect(props.onRemove).toHaveBeenCalledWith("b2");
	});

	it("lists the chosen customers as chips that can be removed", (): void => {
		const props = renderPicker({ selected: [ALICE] });
		expect(screen.getByText("1 of 2")).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Remove Alice Johnson" }));
		});
		expect(props.onRemove).toHaveBeenCalledWith("a1");
	});

	it("will not pick a customer who cannot be reached, and says why", (): void => {
		renderPicker();
		expect(screen.getByText("Opted out")).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: /Carol Tan/u }).hasAttribute("data-disabled")).toBe(true);
	});

	it("stops adding once the pick is full, but still lets a chosen customer go", (): void => {
		renderPicker({ selected: [ALICE, BOB] });
		expect(screen.getByText(/most one pick can hold/u)).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: /Bob Smith/u }).hasAttribute("data-disabled")).toBe(false);
	});

	it("reports what was typed into the search", (): void => {
		const props = renderPicker();
		fireEvent.change(screen.getByRole("searchbox", { name: "Search customers" }), { target: { value: "ali" } });
		expect(props.onSearchChange).toHaveBeenCalledWith("ali");
	});

	it("explains an empty search, an empty list and a failed load", (): void => {
		renderPicker({ options: [], search: "zzz" });
		expect(screen.getByText("No customer matches that search.")).toBeTruthy();
		cleanup();
		renderPicker({ options: [] });
		expect(screen.getByText(/People become your customers/u)).toBeTruthy();
		cleanup();
		renderPicker({ isError: true });
		expect(screen.getByText(/Couldn't load your customers/u)).toBeTruthy();
	});

	it("shows its validation message tied to the search box", (): void => {
		renderPicker({ errorMessage: "Choose at least one customer" });
		expect(screen.getByRole("alert").textContent).toBe("Choose at least one customer");
		expect(screen.getByRole("searchbox").getAttribute("aria-describedby")).toBe("picker-error");
	});
});
