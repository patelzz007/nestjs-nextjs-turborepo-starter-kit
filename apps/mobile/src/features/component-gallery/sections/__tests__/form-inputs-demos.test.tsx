import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";

import { FormInputsDemos } from "../form-inputs-demos";

/** The demo's pretend check, in ms (form-inputs-demos.tsx → DEMO_CHECK_MS). */
const DEMO_CHECK_MS = 1200;

const DEMO_TITLES: readonly string[] = [
	"Text",
	"Icon",
	"TextLink",
	"Field",
	"Input",
	"Textarea",
	"InputGroup",
	"PasswordInput",
	"PasswordStrengthMeter",
	"InputOTP",
	"TextField",
];

describe("FormInputsDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<FormInputsDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getAllByText(title).length).toBeGreaterThan(0);
		}
	});

	it("validates the field demo's email as it is typed", async () => {
		await render(<FormInputsDemos />);
		const block = within(screen.getByTestId("demo-Field"));

		expect(block.getByRole("alert")).toHaveTextContent("Enter a valid email address");
		await fireEvent.changeText(block.getByLabelText("Work email"), "alex@example.com");
		expect(block.queryByRole("alert")).toBeNull();
	});

	it("shows and hides a password, and rates a stronger one higher", async () => {
		await render(<FormInputsDemos />);
		const passwordBlock = within(screen.getByTestId("demo-PasswordInput"));
		await fireEvent.press(passwordBlock.getByRole("button", { name: "Show password" }));
		expect(passwordBlock.getByLabelText("Password")).toHaveProp("secureTextEntry", false);

		const meterBlock = within(screen.getByTestId("demo-PasswordStrengthMeter"));
		expect(meterBlock.getByRole("progressbar", { name: "Password strength: Fair" })).toBeOnTheScreen();
		await fireEvent.changeText(meterBlock.getByLabelText("New password"), "Hunter2!x");
		expect(meterBlock.getByRole("progressbar", { name: "Password strength: Strong" })).toBeOnTheScreen();
	});

	it("checks a completed one-time code and shows a wrong one as an error", async () => {
		jest.useFakeTimers();
		await render(<FormInputsDemos />);
		const block = within(screen.getByTestId("demo-InputOTP"));

		await fireEvent.changeText(block.getByLabelText("Authentication code"), "654321");
		expect(block.getByLabelText("Authentication code")).toBeBusy();
		await act(async () => {
			jest.advanceTimersByTime(DEMO_CHECK_MS);
			await Promise.resolve();
		});
		expect(block.getByRole("alert")).toHaveTextContent("That code is not right — try 123456");
		jest.useRealTimers();
	});

	it("counts presses on the text links", async () => {
		await render(<FormInputsDemos />);
		const block = within(screen.getByTestId("demo-TextLink"));

		await fireEvent.press(block.getByRole("link", { name: "Create one" }));
		expect(block.getByText("Links pressed: 1")).toBeOnTheScreen();
	});
});
