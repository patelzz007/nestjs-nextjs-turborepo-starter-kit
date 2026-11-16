import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { SHEET_MOTION } from "../../lib/motion";
import { ContextMenu } from "../context-menu";
import type { DropdownMenuItemData } from "../dropdown-menu";

const AREA = "Right click here";
const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "copy", label: "Copy" },
	{ value: "more", label: "More tools", items: [{ value: "save", label: "Save page" }] },
	{ value: "grid", label: "Show grid", kind: "checkbox", checked: true },
];

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("ContextMenu", () => {
	it("opens its actions on a long press, opens submenus in place and closes after an action", async () => {
		const onSelect = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(
			<ContextMenu ref={ref} title="Page" items={ITEMS} onSelect={onSelect}>
				<Text>{AREA}</Text>
			</ContextMenu>,
		);
		const area = screen.getByRole("button", { name: "Page" });
		expect(area).toHaveProp("accessibilityHint", "Long press for actions");
		await fireEvent(area, "longPress");
		await fireEvent.press(screen.getByRole("checkbox", { name: "Show grid" }));
		expect(onSelect).toHaveBeenLastCalledWith("grid");
		await fireEvent.press(screen.getByRole("menuitem", { name: "More tools" }));
		await fireEvent.press(screen.getByRole("button", { name: "Back to Page" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Copy" }));
		expect(onSelect).toHaveBeenLastCalledWith("copy");
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
		expect(ref.current).not.toBeNull();
	});

	it("opens for a screen reader's long press action", async () => {
		await render(
			<ContextMenu title="Page" items={ITEMS} onSelect={jest.fn()}>
				<Text>{AREA}</Text>
			</ContextMenu>,
		);
		await fireEvent(screen.getByRole("button", { name: "Page" }), "accessibilityAction", { nativeEvent: { actionName: "longpress" } });
		expect(screen.getByRole("menuitem", { name: "Copy" })).toBeOnTheScreen();
	});
});
