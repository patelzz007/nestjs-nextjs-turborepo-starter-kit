import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { KeyboardAvoidingView, type KeyboardAvoidingViewInstance } from "../keyboard-avoiding-view";

describe("KeyboardAvoidingView", () => {
	it("pads by the keyboard and fills its parent by default", async () => {
		await render(
			<KeyboardAvoidingView testID="avoiding">
				<Text>Body</Text>
			</KeyboardAvoidingView>,
		);

		const view = screen.getByTestId("avoiding");
		expect(view).toHaveProp("behavior", "padding");
		expect(view).toHaveProp("className", expect.stringContaining("flex-1"));
		expect(screen.getByText("Body")).toBeOnTheScreen();
	});

	it("wraps only its content in the content variant", async () => {
		await render(
			<KeyboardAvoidingView variant="content" testID="avoiding">
				<Text>Body</Text>
			</KeyboardAvoidingView>,
		);
		expect(screen.getByTestId("avoiding")).not.toHaveProp("className", expect.stringContaining("flex-1"));
	});

	it("forwards its ref, and merges the caller's className last", async () => {
		const ref = React.createRef<KeyboardAvoidingViewInstance>();
		await render(
			<KeyboardAvoidingView ref={ref} className="justify-end" testID="avoiding">
				<Text>Body</Text>
			</KeyboardAvoidingView>,
		);
		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("avoiding")).toHaveProp("className", "flex-1 justify-end");
	});
});
