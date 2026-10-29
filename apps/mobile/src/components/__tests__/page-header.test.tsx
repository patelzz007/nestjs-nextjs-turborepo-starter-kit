import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";
import { makeMutable } from "react-native-reanimated";

import { PAGE_HEADER_ROW_HEIGHT, PageHeader, pageHeaderControlsBottom, type PageHeaderProps } from "../page-header";

interface Handlers {
	readonly onMenu: jest.Mock;
	readonly onBack: jest.Mock;
	readonly onNotifications: jest.Mock;
	readonly onHeightChange: jest.Mock;
	readonly onCollapseDistanceChange: jest.Mock;
}

function handlers(): Handlers {
	return { onMenu: jest.fn(), onBack: jest.fn(), onNotifications: jest.fn(), onHeightChange: jest.fn(), onCollapseDistanceChange: jest.fn() };
}

type HeaderOverrides = Partial<Omit<PageHeaderProps, keyof Handlers | "progress" | "collapseDistance">> & { readonly progressValue?: number };

/** Expanded: at the top of the page. */
const AT_TOP = 0;

function header(actions: Handlers, { progressValue = AT_TOP, ...overrides }: HeaderOverrides = {}): React.JSX.Element {
	return (
		<PageHeader
			title="Home"
			subtitle="Your account at a glance"
			titleKey="/"
			titleDrift={0}
			leading="menu"
			topInset={47}
			progress={makeMutable(progressValue)}
			collapseDistance={makeMutable(36)}
			testID="header"
			{...actions}
			{...overrides}
		/>
	);
}

/** A layout event of `height` points. */
function layout(height: number): { readonly nativeEvent: { readonly layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } };
}

describe("PageHeader", () => {
	it("shows the page's title as the screen's heading with its subtitle, the menu and notifications", async () => {
		const actions = handlers();
		await render(header(actions));

		expect(screen.getByRole("header", { name: "Home" })).toBeOnTheScreen();
		expect(screen.getByText("Your account at a glance")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Open menu" }));
		await fireEvent.press(screen.getByRole("button", { name: "Notifications" }));
		expect(actions.onMenu).toHaveBeenCalledTimes(1);
		expect(actions.onNotifications).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
	});

	it("shows what the app puts beside the notifications button (its status)", async () => {
		await render(header(handlers(), { trailing: <Text>Online</Text> }));

		expect(screen.getByText("Online")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Notifications" })).toBeOnTheScreen();
	});

	it("leads with back deeper in a stack", async () => {
		const actions = handlers();
		await render(header(actions, { leading: "back", title: "Security", subtitle: "Your password and sign-in", titleKey: "/settings/security" }));

		await fireEvent.press(screen.getByRole("button", { name: "Back" }));

		expect(actions.onBack).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
	});

	it("runs its colour up behind the status bar, and lets touches through everywhere but its controls", async () => {
		await render(header(handlers()));

		expect(screen.getByTestId("header")).toHaveProp("pointerEvents", "box-none");
		expect(screen.getByTestId("header")).toHaveStyle({ paddingTop: 47 });
		expect(screen.getByTestId("header-title")).toBeOnTheScreen();
	});

	it("reports its full height and its subtitle line's height, rounded up to whole points", async () => {
		const actions = handlers();
		await render(header(actions));

		await fireEvent(screen.getByTestId("header"), "layout", layout(138.4));
		await fireEvent(screen.getByTestId("header-subtitle-line"), "layout", layout(35.2));

		expect(actions.onHeightChange).toHaveBeenCalledWith(139);
		expect(actions.onCollapseDistanceChange).toHaveBeenCalledWith(36);
	});

	it("collapses by lifting only its background, the subtitle fading in place and the controls never moving", async () => {
		await render(header(handlers(), { progressValue: 1 }));

		expect(screen.getByTestId("header-background")).toHaveStyle({ transform: [{ translateY: -36 }] });
		expect(screen.getByTestId("header-controls")).not.toHaveStyle({ transform: [{ translateY: 36 }] });
		expect(screen.getByTestId("header")).not.toHaveStyle({ transform: [{ translateY: -36 }] });
		expect(screen.getByText("Your account at a glance", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("starts expanded: the background in place", async () => {
		await render(header(handlers()));

		expect(screen.getByTestId("header-background")).toHaveStyle({ transform: [{ translateY: -0 }] });
	});

	it("moves to a new page's title, leaving the old one hidden from screen readers while it goes", async () => {
		const actions = handlers();
		const view = await render(header(actions));

		await view.rerender(header(actions, { title: "Profile", subtitle: "Your personal details", titleKey: "/profile", titleDrift: 16 }));

		expect(screen.getAllByRole("header")).toHaveLength(1);
		expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
		expect(screen.getByText("Your personal details")).toBeOnTheScreen();
		expect(screen.queryByText("Home")).toBeNull();
		expect(screen.getByText("Home", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("updates the title and subtitle in place when the same page renames itself", async () => {
		const actions = handlers();
		const view = await render(header(actions, { title: "Turn on two-factor authentication", titleKey: "/settings/two-factor" }));

		await view.rerender(header(actions, { title: "New backup codes", subtitle: "Keep them somewhere safe", titleKey: "/settings/two-factor" }));

		expect(screen.getByRole("header", { name: "New backup codes" })).toBeOnTheScreen();
		expect(screen.getByText("Keep them somewhere safe")).toBeOnTheScreen();
		expect(screen.queryByText("Turn on two-factor authentication", { includeHiddenElements: true })).toBeNull();
	});
});

describe("pageHeaderControlsBottom", () => {
	it("puts what hangs off the header's controls (the toasts) right under the pinned row, below the status bar", () => {
		expect(pageHeaderControlsBottom(47)).toBe(47 + PAGE_HEADER_ROW_HEIGHT);
		expect(pageHeaderControlsBottom(0)).toBe(PAGE_HEADER_ROW_HEIGHT);
	});
});
