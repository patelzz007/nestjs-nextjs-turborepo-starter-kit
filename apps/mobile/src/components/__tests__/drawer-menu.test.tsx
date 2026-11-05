import { fireEvent, render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import * as React from "react";

import { DrawerAccountHeader, DrawerRow, DrawerSection, DrawerSubmenu } from "../drawer-menu";

describe("DrawerAccountHeader", () => {
	it("shows the person on a solid primary block, their initials on the inverse avatar, and one action", async () => {
		const onPress = jest.fn();
		await render(<DrawerAccountHeader name="Alex Morgan" email="alex@example.com" imageUrl={null} action={{ label: "Edit profile", onPress }} testID="account" />);

		expect(screen.getByRole("header", { name: "Alex Morgan" })).toBeOnTheScreen();
		expect(screen.getByText("alex@example.com")).toBeOnTheScreen();
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
		await fireEvent.press(screen.getByRole("button", { name: "Edit profile" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("shows the profile picture when there is one", async () => {
		await render(
			<DrawerAccountHeader name="Alex Morgan" email="alex@example.com" imageUrl="https://cdn.example.com/a.png" action={{ label: "Edit profile", onPress: jest.fn() }} />,
		);

		expect(screen.getByLabelText("Alex Morgan's profile picture")).toBeOnTheScreen();
	});
});

describe("DrawerSection", () => {
	it("titles a section as a header", async () => {
		await render(
			<DrawerSection heading={{ title: "Preferences", tone: "purple" }}>
				<DrawerRow icon={HouseIcon} label="Appearance" onPress={jest.fn()} />
			</DrawerSection>,
		);

		expect(screen.getByRole("header", { name: "Preferences" })).toBeOnTheScreen();
	});

	it("can go without a title", async () => {
		await render(
			<DrawerSection testID="main">
				<DrawerRow icon={HouseIcon} label="Home" onPress={jest.fn()} />
			</DrawerSection>,
		);

		expect(screen.queryByRole("header")).toBeNull();
		expect(screen.getByTestId("main")).toBeOnTheScreen();
	});
});

describe("DrawerRow", () => {
	it("is a button named by its label and current value, reporting presses", async () => {
		const onPress = jest.fn();
		await render(<DrawerRow icon={HouseIcon} label="Appearance" value="System" onPress={onPress} />);

		expect(screen.getByText("System")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Appearance, System" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("announces the current screen as selected, and is unselected by default", async () => {
		await render(
			<DrawerSection>
				<DrawerRow icon={HouseIcon} label="Home" onPress={jest.fn()} selected />
				<DrawerRow icon={HouseIcon} label="Search" onPress={jest.fn()} />
			</DrawerSection>,
		);

		expect(screen.getByRole("button", { name: "Home" })).toBeSelected();
		expect(screen.getByRole("button", { name: "Search" })).not.toBeSelected();
	});

	it("names a destructive row by its label alone", async () => {
		const onPress = jest.fn();
		await render(<DrawerRow icon={HouseIcon} label="Sign out" tone="destructive" onPress={onPress} testID="sign-out" />);

		await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId("sign-out")).toBeOnTheScreen();
	});
});

describe("DrawerRow in a nested menu", () => {
	it("announces a branch as expanded or collapsed, its chevron pointing the way it folds", async () => {
		const onPress = jest.fn();
		await render(<DrawerRow icon={HouseIcon} label="Reports" expanded={false} onPress={onPress} testID="reports" />);

		expect(screen.getByRole("button", { name: "Reports" })).toBeCollapsed();
		expect(screen.getByTestId("reports-chevron", { includeHiddenElements: true })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Reports" }));
		expect(onPress).toHaveBeenCalledTimes(1);

		await render(<DrawerRow icon={HouseIcon} label="Reports" expanded onPress={onPress} />);
		expect(screen.getByRole("button", { name: "Reports" })).toBeExpanded();
	});

	it("gives a screen's row no chevron and no expanded state", async () => {
		await render(<DrawerRow icon={HouseIcon} label="Home" onPress={jest.fn()} testID="home" />);

		expect(screen.queryByTestId("home-chevron", { includeHiddenElements: true })).toBeNull();
		expect(screen.getByRole("button", { name: "Home" })).not.toBeExpanded();
		expect(screen.getByRole("button", { name: "Home" })).not.toBeCollapsed();
	});

	it("puts a branch's rows in a submenu: stepped in, with one vertical line down their left", async () => {
		await render(
			<DrawerSubmenu testID="rows">
				<DrawerRow icon={HouseIcon} label="Security" onPress={jest.fn()} />
			</DrawerSubmenu>,
		);

		const classes = String(screen.getByTestId("rows").props.className).split(" ");
		expect(classes).toEqual(expect.arrayContaining(["border-l", "border-border", "ml-6.5"]));
		expect(screen.getByRole("button", { name: "Security" })).toBeOnTheScreen();
	});
});

describe("DrawerRow glyph tiles", () => {
	function tileClassOf(testID: string): string {
		return String(screen.getByTestId(`${testID}-tile`, { includeHiddenElements: true }).props.className);
	}

	it("tints a titled section's rows in the section's tone", async () => {
		await render(
			<DrawerSection heading={{ title: "Account", tone: "blue" }}>
				<DrawerRow icon={HouseIcon} label="Security" onPress={jest.fn()} testID="security" />
			</DrawerSection>,
		);

		expect(tileClassOf("security")).toContain("bg-tone-blue-soft");
	});

	it("gives the main section's rows a neutral tile, and the destructive row its own tint", async () => {
		await render(
			<DrawerSection>
				<DrawerRow icon={HouseIcon} label="Home" onPress={jest.fn()} testID="home" />
				<DrawerRow icon={HouseIcon} label="Sign out" tone="destructive" onPress={jest.fn()} testID="sign-out" />
			</DrawerSection>,
		);

		expect(tileClassOf("home")).toContain("bg-muted");
		expect(tileClassOf("sign-out")).toContain("bg-destructive-soft");
	});

	it("inverts the tile inside the selected capsule", async () => {
		await render(
			<DrawerSection heading={{ title: "Account", tone: "blue" }}>
				<DrawerRow icon={HouseIcon} label="Security" selected onPress={jest.fn()} testID="security" />
			</DrawerSection>,
		);

		expect(tileClassOf("security")).toContain("bg-primary-foreground/15");
		expect(screen.getByTestId("security")).toHaveProp("className", expect.stringContaining("bg-primary"));
	});
});
