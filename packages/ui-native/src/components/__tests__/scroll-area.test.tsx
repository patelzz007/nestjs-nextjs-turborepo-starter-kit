import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { hiddenEdgesOf, ScrollArea } from "../scroll-area";

const ROW = "Row";

describe("hiddenEdgesOf", () => {
	it("says which edges hide content", () => {
		const frame = { width: 100, height: 100 };
		const content = { width: 300, height: 500 };
		expect(hiddenEdgesOf({ x: 0, y: 0 }, content, frame)).toStrictEqual({ top: false, bottom: true, start: false, end: true });
		expect(hiddenEdgesOf({ x: 200, y: 400 }, content, frame)).toStrictEqual({ top: true, bottom: false, start: true, end: false });
	});
});

describe("ScrollArea", () => {
	it("scrolls its content in a framed box and follows the scroll", async () => {
		await render(
			<ScrollArea fadeEdges gutter variant="outline" accessibilityLabel="Releases" className="h-40" testID="area">
				<Text>{ROW}</Text>
			</ScrollArea>,
		);
		await fireEvent(screen.getByTestId("area-frame"), "layout", { nativeEvent: { layout: { width: 200, height: 160 } } });
		await fireEvent(screen.getByTestId("area"), "contentSizeChange", 200, 800);
		await fireEvent.scroll(screen.getByTestId("area"), { nativeEvent: { contentOffset: { x: 0, y: 100 } } });
		expect(screen.getByText(ROW)).toBeOnTheScreen();
		expect(screen.getByTestId("area-frame")).toHaveProp("className", expect.stringContaining("border"));
	});

	it("pans both ways", async () => {
		await render(
			<ScrollArea orientation="both" showScrollbar={false}>
				<Text>{ROW}</Text>
			</ScrollArea>,
		);
		expect(screen.getByText(ROW)).toBeOnTheScreen();
	});
});
