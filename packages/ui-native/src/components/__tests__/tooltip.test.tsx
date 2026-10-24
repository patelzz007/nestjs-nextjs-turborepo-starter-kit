import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";
import { z } from "zod";

import { Tooltip, type TooltipProps } from "../tooltip";

const CONTENT = "Verified by GitHub";

function tooltip(overrides: Partial<TooltipProps> = {}): React.JSX.Element {
	return (
		<Tooltip content={CONTENT} accessibilityLabel="Verified" testID="tooltip" {...overrides}>
			<Text className="font-sans">Verified</Text>
		</Tooltip>
	);
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID, { includeHiddenElements: true }).props.className);
}

describe("Tooltip", () => {
	it("names the element and carries its explanation as the accessibility hint", async () => {
		await render(tooltip());

		const element = screen.getByTestId("tooltip");
		expect(element).toHaveProp("accessibilityRole", "text");
		expect(element).toHaveProp("accessibilityLabel", "Verified");
		expect(element).toHaveProp("accessibilityHint", CONTENT);
	});

	it("shows the bubble while long-pressed, and hides it when the finger lifts", async () => {
		await render(tooltip());
		expect(screen.queryByText(CONTENT, { includeHiddenElements: true })).toBeNull();

		await fireEvent(screen.getByTestId("tooltip"), "longPress");
		expect(screen.getByText(CONTENT, { includeHiddenElements: true })).toBeOnTheScreen();
		// Screen readers already have the hint: the bubble is for the eye only.
		expect(screen.queryByText(CONTENT)).toBeNull();

		await fireEvent(screen.getByTestId("tooltip"), "pressOut");
		expect(screen.queryByText(CONTENT, { includeHiddenElements: true })).toBeNull();
	});

	it("follows a controlled `open`, and reports open changes", async () => {
		const onOpenChange = jest.fn();
		const view = await render(tooltip({ open: false, onOpenChange }));

		await fireEvent(screen.getByTestId("tooltip"), "longPress");
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(screen.queryByText(CONTENT, { includeHiddenElements: true })).toBeNull();

		await view.rerender(tooltip({ open: true, onOpenChange }));
		expect(screen.getByText(CONTENT, { includeHiddenElements: true })).toBeOnTheScreen();
		await fireEvent(screen.getByTestId("tooltip"), "pressOut");
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("is a button when it has a tap action of its own", async () => {
		const onPress = jest.fn();
		await render(tooltip({ onPress }));

		await fireEvent.press(screen.getByRole("button", { name: "Verified" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("shows nothing and takes no presses while disabled", async () => {
		const onPress = jest.fn();
		await render(tooltip({ onPress, disabled: true }));

		const element = screen.getByRole("button", { name: "Verified" });
		expect(element).toBeDisabled();
		expect(classNameOf("tooltip")).toContain("opacity-60");
		await fireEvent.press(element);
		expect(onPress).not.toHaveBeenCalled();
	});

	it.each([
		["top", "bottom-full"],
		["bottom", "top-full"],
	] satisfies [TooltipProps["side"], string][])("places the bubble on the %s side", async (side, expected) => {
		await render(tooltip({ side, open: true }));
		const slot = screen.getByTestId("tooltip-bubble", { includeHiddenElements: true }).parent;
		expect(z.string().parse(slot?.props.className)).toContain(expected);
	});

	it.each([
		["sm", "px-2"],
		["md", "px-3"],
	] satisfies [TooltipProps["size"], string][])("has a %s bubble", async (size, expected) => {
		await render(tooltip({ size, open: true }));
		expect(classNameOf("tooltip-bubble")).toContain(expected);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<Tooltip ref={ref} content={CONTENT} accessibilityLabel="Verified" className="items-start self-start" testID="tooltip">
				<Text className="font-sans">Verified</Text>
			</Tooltip>,
		);

		expect(ref.current).not.toBeNull();
		const className = classNameOf("tooltip");
		expect(className).toContain("items-start");
		expect(className).not.toContain("items-center");
		expect(className).toContain("self-start");
	});
});
