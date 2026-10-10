import { fireEvent, render, screen } from "@testing-library/react-native";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";

import { ComingSoon } from "./coming-soon";

describe("ComingSoon", () => {
	it("shows the title as a header, the description and the icon it is given", async () => {
		await render(
			<ComingSoon
				icon={SearchIcon}
				title="Search is coming soon"
				description="Find anything from here."
				action={{ label: "Back to home", onPress: jest.fn() }}
				testID="panel"
			/>,
		);

		expect(screen.getByTestId("panel")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Search is coming soon" })).toBeOnTheScreen();
		expect(screen.getByText("Find anything from here.")).toBeOnTheScreen();
	});

	it("offers its one action as a button with the given label and hint", async () => {
		const onPress = jest.fn();
		await render(
			<ComingSoon
				icon={SearchIcon}
				title="Search is coming soon"
				description="Find anything from here."
				action={{ label: "Back to home", onPress, accessibilityHint: "Opens the Home tab" }}
			/>,
		);

		const button = screen.getByRole("button", { name: "Back to home" });
		expect(button).toHaveProp("accessibilityHint", "Opens the Home tab");
		await fireEvent.press(button);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("leaves the hint out when the action has none", async () => {
		await render(<ComingSoon icon={SearchIcon} title="Reports" description="Not built yet." action={{ label: "Go back", onPress: jest.fn() }} />);

		expect(screen.getByRole("button", { name: "Go back" })).not.toHaveProp("accessibilityHint");
	});
});
