import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { Button } from "../button";
import { HoverCard } from "../hover-card";

const CONTENT = "Panel content";

describe("HoverCard", () => {
	it("opens a hover card on a long press, leaving the tap to the trigger", async () => {
		const onPress = jest.fn();
		await render(
			<HoverCard content={<Text>{CONTENT}</Text>} accessibilityLabel="Profile">
				<Button label="@ava" onPress={onPress} />
			</HoverCard>,
		);
		const trigger = screen.getByRole("button", { name: "@ava" });
		expect(trigger).toHaveProp("accessibilityHint", "Long press to preview profile");
		await fireEvent(trigger, "longPress");
		expect(screen.getByText(CONTENT)).toBeOnTheScreen();
	});
});
