import { fireEvent, render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import * as React from "react";

import { DrawerAccountHeader, DrawerRow, DrawerSection } from "./drawer-menu";

describe("DrawerAccountHeader", () => {
	it("shows the person, their initials on the inverse avatar, and one action", async () => {
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
