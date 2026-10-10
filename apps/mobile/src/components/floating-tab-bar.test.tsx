import { fireEvent, render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";

import { FloatingTabBar, type FloatingTabBarItem } from "./floating-tab-bar";

interface TabHandlers {
	readonly home: jest.Mock;
	readonly search: jest.Mock;
	readonly searchLongPress: jest.Mock;
}

function tabs(selected: "home" | "search", handlers: TabHandlers): readonly FloatingTabBarItem[] {
	return [
		{ key: "home", label: "Home", icon: HouseIcon, selected: selected === "home", onPress: handlers.home, testID: "tab-home" },
		{
			key: "search",
			label: "Search",
			icon: SearchIcon,
			selected: selected === "search",
			onPress: handlers.search,
			onLongPress: handlers.searchLongPress,
			testID: "tab-search",
		},
	];
}

function handlers(): TabHandlers {
	return { home: jest.fn(), search: jest.fn(), searchLongPress: jest.fn() };
}

/** A layout event as React Native reports one. */
function layoutOf(
	width: number,
	height: number,
): { readonly nativeEvent: { readonly layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { x: 0, y: 0, width, height } } };
}

describe("FloatingTabBar", () => {
	it("is a tab list whose tabs announce their name and which one is selected", async () => {
		await render(<FloatingTabBar items={tabs("home", handlers())} bottomInset={34} testID="bar" />);

		// The list itself is not an accessibility element (that would swallow its tabs): it carries the role.
		expect(screen.getByTestId("bar-tablist")).toHaveProp("accessibilityRole", "tablist");
		expect(screen.getAllByRole("tab")).toHaveLength(2);
		expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
		expect(screen.getByRole("tab", { name: "Search" })).not.toBeSelected();
	});

	it("names every tab for screen readers, even those that show only their icon", async () => {
		await render(<FloatingTabBar items={tabs("home", handlers())} bottomInset={0} />);

		expect(screen.getByTestId("tab-search")).toHaveAccessibleName("Search");
		expect(screen.getByTestId("tab-home")).toHaveAccessibleName("Home");
	});

	it("reports presses and long presses to the tab's own handlers", async () => {
		const handlersOfTabs = handlers();
		await render(<FloatingTabBar items={tabs("home", handlersOfTabs)} bottomInset={0} />);

		await fireEvent.press(screen.getByRole("tab", { name: "Search" }));
		await fireEvent(screen.getByRole("tab", { name: "Search" }), "longPress");

		expect(handlersOfTabs.search).toHaveBeenCalledTimes(1);
		expect(handlersOfTabs.searchLongPress).toHaveBeenCalledTimes(1);
		expect(handlersOfTabs.home).not.toHaveBeenCalled();
	});

	it("moves the selection when the caller selects another tab", async () => {
		const handlersOfTabs = handlers();
		const view = await render(<FloatingTabBar items={tabs("home", handlersOfTabs)} bottomInset={0} />);

		await view.rerender(<FloatingTabBar items={tabs("search", handlersOfTabs)} bottomInset={0} />);

		expect(screen.getByRole("tab", { name: "Search" })).toBeSelected();
		expect(screen.getByRole("tab", { name: "Home" })).not.toBeSelected();
	});

	it("shows the selected tab's label in one line, sized to the measured label", async () => {
		await render(<FloatingTabBar items={tabs("home", handlers())} bottomInset={0} />);

		await fireEvent(screen.getByTestId("tab-home-label-measure", { includeHiddenElements: true }), "layout", layoutOf(41.2, 20));

		const visibleLabel = screen.getByText("Home");
		expect(visibleLabel).toHaveProp("numberOfLines", 1);
		expect(visibleLabel).toHaveStyle({ width: 42 });
	});

	it("keeps the label's measuring copy away from screen readers", async () => {
		await render(<FloatingTabBar items={tabs("home", handlers())} bottomInset={0} />);

		expect(screen.getAllByText("Home")).toHaveLength(1);
		expect(screen.getAllByText("Home", { includeHiddenElements: true })).toHaveLength(2);
	});

	it("floats above the bottom safe area and reports the height it covers", async () => {
		const onHeightChange = jest.fn();
		await render(<FloatingTabBar items={tabs("home", handlers())} bottomInset={34} onHeightChange={onHeightChange} testID="bar" />);

		expect(screen.getByTestId("bar")).toHaveStyle({ paddingBottom: 46 });
		await fireEvent(screen.getByTestId("bar"), "layout", layoutOf(390, 106));
		expect(onHeightChange).toHaveBeenCalledWith(106);
	});

	it("lays out without a height listener", async () => {
		await render(<FloatingTabBar items={tabs("search", handlers())} bottomInset={0} testID="bar" />);

		await fireEvent(screen.getByTestId("bar"), "layout", layoutOf(390, 72));
		expect(screen.getByRole("tab", { name: "Search" })).toBeSelected();
	});
});
