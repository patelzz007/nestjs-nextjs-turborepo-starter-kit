import { fireEvent, render, screen } from "@testing-library/react-native";
import PencilIcon from "lucide-react-native/icons/pencil";
import TrashIcon from "lucide-react-native/icons/trash";
import * as React from "react";
import type { ViewInstance } from "react-native";
import { z } from "zod";

import { DropdownMenu, type DropdownMenuItemData, type DropdownMenuProps } from "../dropdown-menu";

type Action = "rename" | "archive" | "delete";

const ITEMS: readonly DropdownMenuItemData<Action>[] = [
	{ value: "rename", label: "Rename", icon: PencilIcon },
	{ value: "archive", label: "Archive", disabled: true },
	{ value: "delete", label: "Delete", icon: TrashIcon, variant: "destructive" },
];

function menu(overrides: Partial<DropdownMenuProps<Action>> = {}): React.JSX.Element {
	return <DropdownMenu<Action> label="Project actions" items={ITEMS} onSelect={jest.fn()} testID="menu" {...overrides} />;
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("DropdownMenu", () => {
	it("is a collapsed button named by its label until pressed, then shows its items as a menu", async () => {
		await render(menu());

		const trigger = screen.getByRole("button", { name: "Project actions" });
		expect(trigger).toHaveProp("accessibilityState", expect.objectContaining({ expanded: false }));
		expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();

		await fireEvent.press(trigger);

		expect(screen.getByRole("menuitem", { name: "Rename" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Project actions" })).toBeOnTheScreen();
	});

	it("reports the chosen item's value and closes", async () => {
		const onSelect = jest.fn<undefined, [Action]>();
		await render(menu({ onSelect }));

		await fireEvent.press(screen.getByRole("button", { name: "Project actions" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Delete" }));

		expect(onSelect).toHaveBeenCalledWith("delete");
		expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
	});

	it("draws a destructive item in the destructive tone, and blocks a disabled one", async () => {
		const onSelect = jest.fn();
		await render(menu({ onSelect, open: true }));

		expect(screen.getByText("Delete")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
		const archive = screen.getByRole("menuitem", { name: "Archive" });
		expect(archive).toBeDisabled();
		await fireEvent.press(archive);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("follows a controlled `open`, and reports open changes", async () => {
		const onOpenChange = jest.fn();
		const view = await render(menu({ open: false, onOpenChange }));

		await fireEvent.press(screen.getByRole("button", { name: "Project actions" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		// The caller has not opened it yet: still closed.
		expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();

		await view.rerender(menu({ open: true, onOpenChange, title: "Choose an action" }));
		expect(screen.getByRole("header", { name: "Choose an action" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Close choose an action" }));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("cannot open while disabled or loading; disabled wins over loading, which wins over invalid", async () => {
		const onOpenChange = jest.fn();
		const view = await render(menu({ onOpenChange, disabled: true, loading: true, invalid: true }));
		const trigger = screen.getByRole("button", { name: "Project actions" });
		expect(trigger).toBeDisabled();
		expect(classNameOf("menu")).not.toContain("border-destructive");
		await fireEvent.press(trigger);
		expect(onOpenChange).not.toHaveBeenCalled();

		await view.rerender(menu({ loading: true, invalid: true }));
		expect(screen.getByRole("button", { name: "Project actions" })).toBeBusy();
		expect(classNameOf("menu")).not.toContain("border-destructive");

		await view.rerender(menu({ invalid: true }));
		expect(classNameOf("menu")).toContain("border-destructive");
	});

	it.each([
		["outline", "border-border"],
		["ghost", "bg-transparent"],
	] satisfies [DropdownMenuProps<Action>["variant"], string][])("has a %s trigger", async (variant, expected) => {
		await render(menu({ variant }));
		expect(classNameOf("menu")).toContain(expected);
	});

	it("shows only its glyph at the icon size, still named by its label", async () => {
		await render(menu({ size: "icon", icon: PencilIcon }));

		expect(screen.getByRole("button", { name: "Project actions" })).toHaveProp("className", expect.stringContaining("size-11"));
		expect(screen.queryByText("Project actions")).toBeNull();
	});

	it("reaches 44 pt at the compact size", async () => {
		await render(menu({ size: "sm" }));
		expect(screen.getByRole("button", { name: "Project actions" })).toHaveProp("hitSlop", 4);
	});

	it("forwards its ref to the trigger and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<DropdownMenu ref={ref} label="More" items={ITEMS} onSelect={jest.fn()} className="self-start px-6" testID="menu" />);

		expect(ref.current).not.toBeNull();
		const className = classNameOf("menu");
		expect(className).toContain("px-6");
		expect(className).not.toContain("px-4");
		expect(className).toContain("self-start");
	});
});
