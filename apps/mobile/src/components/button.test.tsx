import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { Button } from "./button";

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
		const ref = React.createRef<View>();
		await render(<Button ref={ref} label="Go" variant="ghost" onPress={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});
});
