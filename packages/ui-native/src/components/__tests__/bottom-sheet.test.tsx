import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, FlatList, Text, type ListRenderItemInfo, type View } from "react-native";
import { z } from "zod";

import { BottomSheet, SheetOptionRow, type BottomSheetSize } from "../bottom-sheet";
import { KeyboardAvoidingView } from "../keyboard-avoiding-view";
import { TextField } from "../text-field";

/** The Modal host element: the rendered tree's root (it carries `onRequestClose` and `animationType`). */
function modal(): NonNullable<typeof screen.root> {
	const { root } = screen;
	if (root === null) {
		throw new Error("Nothing is rendered.");
	}
	return root;
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

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

	it("is a modal sheet whose title is a header", async () => {
		await render(
			<BottomSheet visible title="Filter" onClose={jest.fn()} testID="sheet">
				<Text>Options</Text>
			</BottomSheet>,
		);

		expect(screen.getByTestId("sheet")).toHaveProp("accessibilityViewIsModal", true);
		expect(screen.getByRole("header", { name: "Filter" })).toBeOnTheScreen();
	});

	it("renders nothing while hidden, and closes on the Android back button", async () => {
		const onClose = jest.fn();
		const view = await render(
			<BottomSheet visible={false} title="Filter" onClose={onClose}>
				<Text>Options</Text>
			</BottomSheet>,
		);
		expect(screen.queryByText("Options")).toBeNull();

		await view.rerender(
			<BottomSheet visible title="Filter" onClose={onClose}>
				<Text>Options</Text>
			</BottomSheet>,
		);
		await fireEvent(modal(), "requestClose");
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("slides up, and simply appears under Reduce Motion", async () => {
		await render(
			<BottomSheet visible title="Filter" onClose={jest.fn()}>
				<Text>Options</Text>
			</BottomSheet>,
		);
		expect(modal()).toHaveProp("animationType", "slide");

		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(
			<BottomSheet visible title="Filter" onClose={jest.fn()}>
				<Text>Options</Text>
			</BottomSheet>,
		);
		expect(modal()).toHaveProp("animationType", "none");
	});

	it("names its backdrop with the caller's words", async () => {
		await render(
			<BottomSheet visible title="Filter" onClose={jest.fn()} closeLabel="Dismiss filter">
				<Text>Options</Text>
			</BottomSheet>,
		);
		expect(screen.getByRole("button", { name: "Dismiss filter", includeHiddenElements: true })).toBeOnTheScreen();
	});

	it.each([
		["md", "max-h-4/5"],
		["lg", "max-h-11/12"],
	] satisfies [BottomSheetSize, string][])("has a %s size", async (size, expected) => {
		await render(
			<BottomSheet visible title="Filter" onClose={jest.fn()} size={size} testID="sheet">
				<Text>Options</Text>
			</BottomSheet>,
		);
		expect(classNameOf("sheet")).toContain(expected);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(
			<BottomSheet ref={ref} visible title="Filter" onClose={jest.fn()} className="max-h-full pt-6" testID="sheet">
				<Text>Options</Text>
			</BottomSheet>,
		);

		expect(ref.current).not.toBeNull();
		const className = classNameOf("sheet");
		expect(className).toContain("pt-6");
		expect(className).not.toContain("pt-4");
		expect(className).toContain("max-h-full");
		expect(className).not.toContain("max-h-4/5");
	});
});

describe("SheetOptionRow", () => {
	it("is a radio that reports its own value, typed, and is checked while chosen", async () => {
		const onSelect = jest.fn<undefined, ["merge" | "squash"]>();
		await render(<SheetOptionRow<"merge" | "squash"> value="squash" label="Squash and merge" description="One commit" selected onSelect={onSelect} />);

		const row = screen.getByRole("radio", { name: "Squash and merge" });
		expect(row).toBeChecked();
		expect(row).toHaveProp("accessibilityHint", "One commit");
		expect(screen.getByText("Squash and merge")).toHaveProp("className", expect.stringContaining("font-sans-semibold"));
		await fireEvent.press(row);
		expect(onSelect).toHaveBeenCalledWith("squash");
	});

	it("reads as unchosen in the regular weight", async () => {
		await render(<SheetOptionRow value="merge" label="Create a merge commit" selected={false} onSelect={jest.fn()} />);

		expect(screen.getByRole("radio", { name: "Create a merge commit" })).not.toBeChecked();
		expect(screen.getByText("Create a merge commit")).toHaveProp("className", expect.stringContaining("font-sans"));
		expect(screen.getByText("Create a merge commit")).not.toHaveProp("className", expect.stringContaining("font-sans-semibold"));
	});

	it("cannot be chosen while disabled", async () => {
		const onSelect = jest.fn();
		await render(<SheetOptionRow value="rebase" label="Rebase and merge" selected={false} disabled onSelect={onSelect} />);

		const row = screen.getByRole("radio", { name: "Rebase and merge" });
		expect(row).toBeDisabled();
		expect(row).toHaveProp("className", expect.stringContaining("opacity-60"));
		await fireEvent.press(row);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<SheetOptionRow ref={ref} value="merge" label="Merge" selected={false} onSelect={jest.fn()} className="border-b-0 py-4" testID="row" />);

		expect(ref.current).not.toBeNull();
		const className = classNameOf("row");
		expect(className).toContain("py-4");
		expect(className).not.toContain("py-3");
		expect(className).toContain("border-b-0");
	});
});
