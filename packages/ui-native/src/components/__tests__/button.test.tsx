import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Button } from "../button";

describe("Button", () => {
	it("is an accessible button that reports presses", async () => {
		const onPress = jest.fn();
		await render(<Button label="Save" onPress={onPress} accessibilityHint="Saves your profile" />);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toHaveAccessibleName("Save");
		await fireEvent.press(button);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("blocks presses and announces busy while loading", async () => {
		const onPress = jest.fn();
		await render(<Button label="Save" onPress={onPress} loading />);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toBeBusy();
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(onPress).not.toHaveBeenCalled();
	});

	it("can be disabled, and takes an accessible name other than its label", async () => {
		await render(<Button label="Revoke" accessibilityLabel="Revoke Alex’s iPhone" variant="destructive" onPress={jest.fn()} disabled />);
		expect(screen.getByRole("button", { name: "Revoke Alex’s iPhone" })).toBeDisabled();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Button ref={ref} label="Go" variant="ghost" onPress={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});

	it("has a compact size whose touch area still reaches 44 pt", async () => {
		await render(<Button label="View on GitHub" size="sm" onPress={jest.fn()} />);

		const button = screen.getByRole("button", { name: "View on GitHub" });
		expect(button).toHaveProp("className", expect.stringContaining("min-h-9"));
		expect(button).toHaveProp("hitSlop", 4);
	});

	it("keeps its label on one line, whatever width it is given", async () => {
		await render(<Button label="Review changes" variant="secondary" onPress={jest.fn()} />);

		expect(screen.getByText("Review changes")).toHaveProp("numberOfLines", 1);
	});

	it("shows the caller's validation outcome as its error state, unless it is inactive", async () => {
		await render(<Button label="Submit" onPress={jest.fn()} invalid />);
		expect(screen.getByRole("button", { name: "Submit" })).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<Button label="Submit" onPress={jest.fn()} invalid disabled />);
		expect(screen.getByRole("button", { name: "Submit" })).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("merges the caller's className last, so layout classes win", async () => {
		await render(<Button label="Save" onPress={jest.fn()} className="flex-1 px-8" />);
		const className = String(screen.getByRole("button", { name: "Save" }).props.className);
		expect(className).toContain("flex-1");
		expect(className).toContain("px-8");
		expect(className).not.toContain("px-4");
	});

	it("reports focus and blur (keyboard and switch-control users)", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Button label="Save" onPress={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		const button = screen.getByRole("button", { name: "Save" });
		await fireEvent(button, "focus");
		await fireEvent(button, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
