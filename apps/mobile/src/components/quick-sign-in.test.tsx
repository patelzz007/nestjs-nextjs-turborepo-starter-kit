import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { QuickSignIn } from "./quick-sign-in";

const CHOICES = [
	{ key: "admin@example.com", label: "Admin" },
	{ key: "brew.owner@kl-rewards.demo", label: "KL Owner" },
];

describe("QuickSignIn", () => {
	it("titles the block and offers one named button per account", async () => {
		await render(<QuickSignIn title="Quick sign-in (development)" choices={CHOICES} onSelect={jest.fn()} testID="quick" />);

		expect(screen.getByRole("header", { name: "Quick sign-in (development)" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Sign in as Admin" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Sign in as KL Owner" })).toBeOnTheScreen();
	});

	it("reports which account was chosen", async () => {
		const onSelect = jest.fn();
		await render(<QuickSignIn title="Quick sign-in" choices={CHOICES} onSelect={onSelect} />);

		await fireEvent.press(screen.getByRole("button", { name: "Sign in as KL Owner" }));

		expect(onSelect).toHaveBeenCalledWith("brew.owner@kl-rewards.demo");
	});

	it("waits while a sign-in is running", async () => {
		const onSelect = jest.fn();
		await render(<QuickSignIn title="Quick sign-in" choices={CHOICES} onSelect={onSelect} disabled />);

		const button = screen.getByRole("button", { name: "Sign in as Admin" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
