import { fireEvent, render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import * as React from "react";
import { Text } from "react-native";

import { DrawerDivider, DrawerProfile, DrawerRow, DrawerSection, DrawerSelectionContext, DrawerSubmenu, DrawerWash, type DrawerProfileProps } from "../drawer-menu";

const PERSON: Omit<DrawerProfileProps, "imageUrl"> = {
	name: "Alex Morgan",
	email: "alex@example.com",
	actionLabel: "Edit profile",
	onPress: jest.fn(),
	layout: "row",
	action: "none",
	onInk: false,
};

describe("DrawerProfile", () => {
	it("shows the person, and pressing them is the action", async () => {
		const onPress = jest.fn();
		await render(<DrawerProfile {...PERSON} imageUrl={null} onPress={onPress} />);

		expect(screen.getByRole("header", { name: "Alex Morgan" })).toBeOnTheScreen();
		expect(screen.getByText("alex@example.com")).toBeOnTheScreen();
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
		await fireEvent.press(screen.getByRole("button", { name: "Alex Morgan, Edit profile" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("shows the profile picture when there is one", async () => {
		await render(<DrawerProfile {...PERSON} imageUrl="https://cdn.example.com/a.png" />);

		expect(screen.getByLabelText("Alex Morgan's profile picture")).toBeOnTheScreen();
	});

	it("takes the sign-in panel's colours on ink, and the page's anywhere else", async () => {
		const view = await render(<DrawerProfile {...PERSON} imageUrl={null} onInk />);
		expect(screen.getByRole("header", { name: "Alex Morgan" })).toHaveProp("className", expect.stringContaining("text-auth-panel-foreground"));

		await view.rerender(<DrawerProfile {...PERSON} imageUrl={null} />);
		expect(screen.getByRole("header", { name: "Alex Morgan" })).toHaveProp("className", expect.stringContaining("text-foreground"));
	});

	it("spells the action out as a link only when the look asks", async () => {
		const view = await render(<DrawerProfile {...PERSON} imageUrl={null} action="link" />);
		expect(screen.getByText("Edit profile")).toBeOnTheScreen();

		await view.rerender(<DrawerProfile {...PERSON} imageUrl={null} action="chevron" />);
		expect(screen.queryByText("Edit profile")).toBeNull();
	});

	it("puts a detail under the email", async () => {
		await render(<DrawerProfile {...PERSON} imageUrl={null} detail={<Text>Strong, 42 ms</Text>} />);

		expect(screen.getByText("Strong, 42 ms")).toBeOnTheScreen();
	});
});

describe("DrawerWash", () => {
	it("is decoration: nothing a screen reader or a touch reaches", async () => {
		await render(<DrawerWash />);

		expect(screen.getByTestId("drawer-wash", { includeHiddenElements: true })).toHaveProp("pointerEvents", "none");
		expect(screen.getByTestId("drawer-wash", { includeHiddenElements: true })).toHaveProp("accessibilityElementsHidden", true);
	});
});

describe("DrawerSection", () => {
	it("titles a section as a header", async () => {
		await render(
			<DrawerSection title="Preferences">
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
		expect(classes).toEqual(expect.arrayContaining(["border-l", "border-border", "ml-6"]));
		expect(screen.getByRole("button", { name: "Security" })).toBeOnTheScreen();
	});
});

describe("DrawerDivider", () => {
	it("is a hairline only sighted people need", async () => {
		await render(<DrawerDivider />);

		const line = screen.getByTestId("drawer-divider", { includeHiddenElements: true });
		expect(line).toHaveProp("className", expect.stringContaining("bg-border"));
		expect(line).toHaveProp("accessibilityElementsHidden", true);
	});
});

describe("DrawerRow capsule", () => {
	it("draws the screen on show as a solid capsule by default", async () => {
		await render(<DrawerRow icon={HouseIcon} label="Security" selected onPress={jest.fn()} testID="security" />);

		expect(screen.getByTestId("security")).toHaveProp("className", expect.stringContaining("bg-primary"));
		expect(screen.getByText("Security")).toHaveProp("className", expect.stringContaining("text-primary-foreground"));
	});

	it("draws it as a soft capsule when the look says so", async () => {
		await render(
			<DrawerSelectionContext.Provider value="soft">
				<DrawerRow icon={HouseIcon} label="Security" selected onPress={jest.fn()} testID="security" />
			</DrawerSelectionContext.Provider>,
		);

		expect(screen.getByTestId("security")).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(screen.getByText("Security")).toHaveProp("className", expect.stringContaining("text-foreground"));
	});

	it("makes the soft capsule slate in the light theme, its text and icon light on it", async () => {
		await render(
			<DrawerSelectionContext.Provider value="soft">
				<DrawerRow icon={HouseIcon} label="Security" selected onPress={jest.fn()} testID="security" />
			</DrawerSelectionContext.Provider>,
		);

		expect(screen.getByTestId("security")).toHaveProp("className", expect.stringContaining("light:bg-primary"));
		expect(screen.getByText("Security")).toHaveProp("className", expect.stringContaining("light:text-primary-foreground"));
	});

	it("leaves other rows bare, and a destructive one red", async () => {
		await render(
			<>
				<DrawerRow icon={HouseIcon} label="Home" onPress={jest.fn()} testID="home" />
				<DrawerRow icon={HouseIcon} label="Sign out" tone="destructive" onPress={jest.fn()} />
			</>,
		);

		expect(screen.getByTestId("home")).toHaveProp("className", expect.not.stringContaining("bg-primary"));
		expect(screen.getByText("Sign out")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
	});
});
