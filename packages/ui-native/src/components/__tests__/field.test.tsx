import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInstance, ViewInstance } from "react-native";

import { Field, FieldError, FieldHint, FieldLabel } from "../field";
import { Input } from "../input";

const CUSTOM_LABEL = "Custom label";
const CUSTOM_HINT = "Custom hint";
const CUSTOM_ERROR = "Custom error";

describe("Field", () => {
	it("names and describes the control inside it by its label and hint", async () => {
		await render(
			<Field label="Email" hint="We never share it">
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);

		const input = screen.getByLabelText("Email");
		expect(input).toHaveProp("accessibilityHint", "We never share it");
		expect(screen.getByText("Email")).toBeOnTheScreen();
		expect(screen.getByText("We never share it")).toBeOnTheScreen();
	});

	it("ties the control to the label's id (Android)", async () => {
		await render(
			<Field label="Email">
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);

		const labelId = String(screen.getByText("Email").props.nativeID);
		expect(screen.getByLabelText("Email")).toHaveProp("accessibilityLabelledBy", labelId);
	});

	it("announces its error as an alert and makes the control invalid", async () => {
		await render(
			<Field label="Email" error="Enter a valid email">
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
		expect(String(screen.getByLabelText("Email").parent?.props.className)).toContain("border-destructive");
	});

	it("shows no error element for an empty message", async () => {
		await render(
			<Field label="Name" error="">
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("passes its disabled and loading state to the control; the control's own props win", async () => {
		await render(
			<Field label="Name" disabled>
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);
		expect(screen.getByLabelText("Name")).toBeDisabled();
		expect(screen.getByText("Name")).toHaveProp("className", expect.stringContaining("text-muted-foreground"));

		await render(
			<Field label="Name" loading>
				<Input value="" onChange={jest.fn()} accessibilityLabel="Display name" loading={false} />
			</Field>,
		);
		expect(screen.getByLabelText("Display name")).not.toBeBusy();
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<Field ref={ref} label="Name" className="gap-4" testID="field">
				<Input value="" onChange={jest.fn()} />
			</Field>,
		);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("field").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-1.5");
	});

	it("exports its parts for a custom layout, each forwarding its ref", async () => {
		const ref = React.createRef<TextInstance>();
		await render(
			<>
				<FieldLabel ref={ref} className="text-base">
					{CUSTOM_LABEL}
				</FieldLabel>
				<FieldHint>{CUSTOM_HINT}</FieldHint>
				<FieldError>{CUSTOM_ERROR}</FieldError>
			</>,
		);

		expect(ref.current).not.toBeNull();
		expect(screen.getByText("Custom label")).toHaveProp("className", expect.stringContaining("text-base"));
		expect(screen.getByText("Custom hint")).toBeOnTheScreen();
		expect(screen.getByRole("alert")).toHaveTextContent("Custom error");
	});
});
