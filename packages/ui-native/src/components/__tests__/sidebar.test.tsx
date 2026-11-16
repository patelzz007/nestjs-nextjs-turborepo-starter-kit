import { fireEvent, render, screen } from "@testing-library/react-native";
import FolderIcon from "lucide-react-native/icons/folder";
import HomeIcon from "lucide-react-native/icons/home";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { filterSidebarItems, Sidebar, type SidebarGroup, type SidebarItem } from "../sidebar";

const HEADER = "Acme";

function groups(onPress: () => void): readonly SidebarGroup[] {
	return [
		{
			key: "main",
			label: "Main",
			items: [
				{ key: "home", label: "Home", icon: HomeIcon, active: true, onPress },
				{
					key: "projects",
					label: "Projects",
					icon: FolderIcon,
					badge: "3",
					items: [
						{ key: "web", label: "Website", onPress },
						{ key: "app", label: "Mobile app", onPress },
					],
				},
				{ key: "pinned", label: "Pinned note", pinned: true, onPress },
			],
		},
	];
}

describe("filterSidebarItems", () => {
	it("keeps matches (with their matching sub-items) and pinned items", () => {
		const items: readonly SidebarItem[] = groups(jest.fn()).at(0)?.items ?? [];
		expect(filterSidebarItems(items, "mobile").map((item) => item.key)).toStrictEqual(["projects", "pinned"]);
		expect(
			filterSidebarItems(items, "mobile")
				.at(0)
				?.items?.map((item) => item.key),
		).toStrictEqual(["app"]);
		expect(filterSidebarItems(items, " ")).toBe(items);
	});
});

describe("Sidebar", () => {
	it("goes to items, opens sub-menus, and searches", async () => {
		const onPress = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<Sidebar ref={ref} groups={groups(onPress)} header={<Text>{HEADER}</Text>} searchPlaceholder="Search" variant="inset" />);
		expect(screen.getByRole("link", { name: "Home" })).toBeSelected();
		await fireEvent.press(screen.getByRole("button", { name: "Projects, 3" }));
		await fireEvent.press(screen.getByRole("link", { name: "Website" }));
		expect(onPress).toHaveBeenCalled();
		await fireEvent.changeText(screen.getByLabelText("Search"), "zzz");
		expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
		expect(screen.getByRole("link", { name: "Pinned note" })).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Search"), "mobile");
		expect(screen.getByRole("link", { name: "Mobile app" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
		expect(ref.current).not.toBeNull();
	});

	it("says so when a search keeps nothing", async () => {
		await render(<Sidebar groups={[{ key: "g", items: [{ key: "a", label: "Alpha" }] }]} searchPlaceholder="Search" emptyMessage="No pages." />);
		await fireEvent.changeText(screen.getByLabelText("Search"), "zzz");
		expect(screen.getByText("No pages.")).toBeOnTheScreen();
	});

	it("collapses to an icon rail and shows loading", async () => {
		await render(<Sidebar groups={groups(jest.fn())} collapsed loading />);
		expect(screen.queryByText("Home")).toBeNull();
		expect(screen.getByRole("link", { name: "Home" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
	});
});
