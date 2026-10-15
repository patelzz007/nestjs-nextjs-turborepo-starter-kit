import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import { FlatList, Text, type ListRenderItemInfo } from "react-native";

import { BottomSheet, SheetOptionRow } from "./bottom-sheet";
import { KeyboardAvoidingView } from "./keyboard-avoiding-view";
import { TextField } from "./text-field";

function renderRow({ item }: ListRenderItemInfo<string>): React.JSX.Element {
	return <Text>{item}</Text>;
}

describe("KeyboardAvoidingView", () => {
	it("pads by the keyboard, through keyboard-controller — React Native's own never hears of the keyboard inside a sheet's window on Android", async () => {
		await render(
			<KeyboardAvoidingView className="flex-1" testID="avoiding">
				<Text>Body</Text>
			</KeyboardAvoidingView>,
		);

		expect(screen.getByTestId("avoiding")).toHaveProp("behavior", "padding");
		expect(screen.getByText("Body")).toBeOnTheScreen();
	});
});

describe("BottomSheet", () => {
	it("keeps its body above the keyboard and scrolls it, so a field low in a tall sheet can be brought into view", async () => {
		await render(
			<BottomSheet visible title="Merge pull request" onClose={jest.fn()} testID="sheet">
				<SheetOptionRow value="merge" label="Create a merge commit" selected onSelect={jest.fn()} />
				<TextField label="Commit message" value="" onChange={jest.fn()} testID="sheet-message" />
			</BottomSheet>,
		);

		expect(screen.getByTestId("sheet-keyboard")).toHaveProp("behavior", "padding");
		const body = screen.getByTestId("sheet-body");
		expect(body).toHaveProp("keyboardShouldPersistTaps", "handled");
		expect(within(body).getByTestId("sheet-message")).toBeOnTheScreen();
	});

	it("closes from its close button and its backdrop", async () => {
		const onClose = jest.fn();
		await render(
			<BottomSheet visible title="Filter" onClose={onClose}>
				<Text>Options</Text>
			</BottomSheet>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Close filter" }));
		// The backdrop is for touch: screen readers stay in the sheet (`accessibilityViewIsModal`).
		await fireEvent.press(screen.getByRole("button", { name: "Close", includeHiddenElements: true }));

		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("leaves a list that scrolls itself unwrapped — a virtualized list is never nested in a scroll view", async () => {
		await render(
			<BottomSheet visible title="Repository" onClose={jest.fn()} scrollsItself testID="sheet">
				<FlatList data={["a", "b"]} renderItem={renderRow} testID="sheet-list" />
			</BottomSheet>,
		);

		const body = screen.getByTestId("sheet-body");
		expect(body.type).toBe("View");
		expect(within(body).getByTestId("sheet-list")).toBeOnTheScreen();
		expect(screen.getByTestId("sheet-keyboard")).toHaveProp("behavior", "padding");
	});
});
