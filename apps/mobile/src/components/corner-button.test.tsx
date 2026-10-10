import { fireEvent, render, screen } from "@testing-library/react-native";
import MenuIcon from "lucide-react-native/icons/menu";
import * as React from "react";

import { CornerButton } from "./corner-button";

describe("CornerButton", () => {
	it("is a named button that reports presses while visible", async () => {
		const onPress = jest.fn();
		await render(<CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={onPress} visible topInset={47} testID="corner" />);

		await fireEvent.press(screen.getByRole("button", { name: "Open menu" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("takes no touches and is hidden from screen readers while invisible — but stays mounted", async () => {
		await render(<CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={jest.fn()} visible={false} topInset={47} testID="corner" />);

		expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
		expect(screen.getByTestId("corner", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("keeps the same button when it hides and shows again (no re-mount, no flicker)", async () => {
		const view = await render(<CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={jest.fn()} visible topInset={0} testID="corner" />);
		const button = screen.getByTestId("corner");

		await view.rerender(<CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={jest.fn()} visible={false} topInset={0} testID="corner" />);
		await view.rerender(<CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={jest.fn()} visible topInset={0} testID="corner" />);

		expect(screen.getByTestId("corner")).toBe(button);
	});
});
