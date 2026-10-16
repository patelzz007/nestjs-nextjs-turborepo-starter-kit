import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { PageHeader, type PageHeaderProps } from "../page-header";

interface Handlers {
	readonly onMenu: jest.Mock;
	readonly onBack: jest.Mock;
}

function handlers(): Handlers {
	return { onMenu: jest.fn(), onBack: jest.fn() };
}

function header(props: Partial<PageHeaderProps> & Handlers): React.JSX.Element {
	return <PageHeader title="Home" titleKey="/" titleDrift={0} leading="menu" topInset={47} testID="header" {...props} />;
}

describe("PageHeader", () => {
	it("shows the page's title as the screen's heading, the menu, and what sits on the right", async () => {
		const actions = handlers();
		await render(header({ ...actions, trailing: <Text>Online</Text> }));

		expect(screen.getByRole("header", { name: "Home" })).toBeOnTheScreen();
		expect(screen.getByText("Online")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Open menu" }));
		expect(actions.onMenu).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
	});

	it("leads with back deeper in a stack", async () => {
		const actions = handlers();
		await render(header({ ...actions, leading: "back", title: "Security", titleKey: "/settings/security" }));

		await fireEvent.press(screen.getByRole("button", { name: "Back" }));

		expect(actions.onBack).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
	});

	it("runs its colour up behind the status bar, and lets touches through everywhere but its controls", async () => {
		await render(header(handlers()));

		expect(screen.getByTestId("header")).toHaveProp("pointerEvents", "box-none");
		expect(screen.getByTestId("header-title")).toBeOnTheScreen();
	});

	it("moves to a new page's title, leaving the old one hidden from screen readers while it goes", async () => {
		const actions = handlers();
		const view = await render(header(actions));

		await view.rerender(header({ ...actions, title: "Profile", titleKey: "/profile", titleDrift: 16 }));

		expect(screen.getAllByRole("header")).toHaveLength(1);
		expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
		expect(screen.queryByText("Home")).toBeNull();
		expect(screen.getByText("Home", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("updates the title in place when the same page renames itself", async () => {
		const actions = handlers();
		const view = await render(header({ ...actions, title: "Turn on two-factor authentication", titleKey: "/settings/two-factor" }));

		await view.rerender(header({ ...actions, title: "New backup codes", titleKey: "/settings/two-factor" }));

		expect(screen.getByRole("header", { name: "New backup codes" })).toBeOnTheScreen();
		expect(screen.queryByText("Turn on two-factor authentication", { includeHiddenElements: true })).toBeNull();
	});
});
