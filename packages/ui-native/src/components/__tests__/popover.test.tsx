import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Button } from "../button";
import { Popover, popoverPlacementOf } from "../popover";

const SCREEN = { width: 400, height: 800 };
const PANEL = { width: 200, height: 100 };
const CONTENT = "Panel content";

describe("popoverPlacementOf", () => {
	it("places the panel on its side, lined up by its alignment", () => {
		const anchor = { x: 100, y: 300, width: 100, height: 40 };
		expect(popoverPlacementOf(anchor, PANEL, SCREEN, "bottom", "start")).toStrictEqual({ top: 348, left: 100, side: "bottom" });
		expect(popoverPlacementOf(anchor, PANEL, SCREEN, "top", "center")).toStrictEqual({ top: 192, left: 50, side: "top" });
		expect(popoverPlacementOf({ x: 50, y: 300, width: 40, height: 40 }, PANEL, SCREEN, "right", "end")).toStrictEqual({ top: 240, left: 98, side: "right" });
	});

	it("flips to the other side when it does not fit, and keeps inside the screen's edges", () => {
		expect(popoverPlacementOf({ x: 100, y: 740, width: 100, height: 40 }, PANEL, SCREEN, "bottom", "start").side).toBe("top");
		expect(popoverPlacementOf({ x: 350, y: 300, width: 40, height: 40 }, PANEL, SCREEN, "bottom", "start").left).toBe(184);
		expect(popoverPlacementOf({ x: 10, y: 300, width: 40, height: 40 }, PANEL, SCREEN, "left", "center").side).toBe("right");
	});
});

describe("Popover", () => {
	it("opens from its trigger's press, measured, and closes from outside", async () => {
		const onOpenChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(
			<Popover ref={ref} content={<Text>{CONTENT}</Text>} accessibilityLabel="Dimensions" onOpenChange={onOpenChange} testID="popover">
				<Button label="Open" onPress={jest.fn()} />
			</Popover>,
		);
		expect(screen.queryByText(CONTENT)).toBeNull();
		const trigger = screen.getByRole("button", { name: "Open" });
		expect(trigger).toHaveProp("accessibilityHint", "Opens dimensions");
		await fireEvent.press(trigger);
		expect(screen.getByText(CONTENT)).toBeOnTheScreen();
		await fireEvent(screen.getByTestId("popover"), "layout", { nativeEvent: { layout: { width: 200, height: 100 } } });
		await fireEvent.press(screen.getByTestId("popover-backdrop", { includeHiddenElements: true }));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(ref.current).toBeDefined();
	});
});
