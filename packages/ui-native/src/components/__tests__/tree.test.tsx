import { fireEvent, render, screen } from "@testing-library/react-native";
import FolderIcon from "lucide-react-native/icons/folder";
import FolderOpenIcon from "lucide-react-native/icons/folder-open";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Tree, type TreeNode, visibleTreeRows } from "../tree";

const AVATAR = "face";
const ITEMS: readonly TreeNode[] = [
	{
		value: "src",
		label: "src",
		icon: FolderIcon,
		openIcon: FolderOpenIcon,
		children: [
			{ value: "app", label: "app.tsx" },
			{ value: "lib", label: "lib", children: [{ value: "utils", label: "utils.ts" }] },
		],
	},
	{ value: "readme", label: "README.md", leading: <Text>{AVATAR}</Text>, description: "Docs" },
];

describe("visibleTreeRows", () => {
	it("lists open branches' children under them, deeper each level", () => {
		expect(visibleTreeRows(ITEMS, []).map((row) => row.node.value)).toStrictEqual(["src", "readme"]);
		expect(visibleTreeRows(ITEMS, ["src", "lib"]).map((row) => `${row.node.value}:${String(row.depth)}`)).toStrictEqual(["src:0", "app:1", "lib:1", "utils:2", "readme:0"]);
	});
});

describe("Tree", () => {
	it("opens and closes branches in place, and reports the pressed row", async () => {
		const onSelect = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<Tree ref={ref} items={ITEMS} onSelect={onSelect} selected="readme" guides toggle="plus" indent="lg" />);
		expect(screen.queryByRole("button", { name: "app.tsx" })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "src" }));
		expect(screen.getByRole("button", { name: "src" })).toBeExpanded();
		expect(screen.getByRole("button", { name: "app.tsx" })).toBeOnTheScreen();
		expect(onSelect).toHaveBeenCalledWith("src");
		expect(screen.getByRole("button", { name: "README.md, Docs" })).toBeSelected();
		expect(screen.getByText(AVATAR)).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});

	it("ticks leaves with cascading checkboxes, a partly ticked branch showing mixed", async () => {
		const onCheckedChange = jest.fn();
		const onExpandedChange = jest.fn();
		await render(<Tree items={ITEMS} expanded={["src", "lib"]} onExpandedChange={onExpandedChange} checked={["app"]} onCheckedChange={onCheckedChange} />);
		expect(screen.getByRole("checkbox", { name: "Allow src" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: "mixed" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Allow src" }));
		expect(onCheckedChange).toHaveBeenCalledWith(["app", "utils"]);
		await fireEvent.press(screen.getByRole("button", { name: "lib" }));
		expect(onExpandedChange).toHaveBeenCalledWith(["src"]);
	});
});
