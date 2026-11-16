import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { ResizableGroup, ResizablePanel, resizeAt } from "../resizable";

const LEFT = "Left";
const RIGHT = "Right";

describe("resizeAt", () => {
	it("trades size between the two panels by a handle, within their minimums", () => {
		expect(resizeAt([25, 75], 0, 10, [])).toStrictEqual([35, 65]);
		expect(resizeAt([25, 75], 0, -30, [])).toStrictEqual([10, 90]);
		expect(resizeAt([25, 50, 25], 1, 40, [10, 10, 20])).toStrictEqual([25, 55, 20]);
		expect(resizeAt([50, 50], 3, 10, [])).toStrictEqual([50, 50]);
	});
});

describe("ResizableGroup", () => {
	it("resizes by dragging the handle and by a screen reader's steps", async () => {
		const onSizesChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(
			<ResizableGroup ref={ref} defaultSizes={[25, 75]} onSizesChange={onSizesChange} handle="pill" panelLabels={["Sidebar", "Content"]} testID="group">
				<ResizablePanel>
					<Text>{LEFT}</Text>
				</ResizablePanel>
				<ResizablePanel>
					<Text>{RIGHT}</Text>
				</ResizablePanel>
			</ResizableGroup>,
		);
		await fireEvent(screen.getByTestId("group"), "layout", { nativeEvent: { layout: { width: 400, height: 200 } } });
		const handle = screen.getByLabelText("Resize Sidebar and Content");
		await fireEvent(handle, "responderGrant", { nativeEvent: { pageX: 100, pageY: 0 } });
		await fireEvent(handle, "responderMove", { nativeEvent: { pageX: 140, pageY: 0 } });
		expect(onSizesChange).toHaveBeenLastCalledWith([35, 65]);
		await fireEvent(handle, "responderRelease");
		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onSizesChange).toHaveBeenLastCalledWith([30, 70]);
		expect(ref.current).not.toBeNull();
	});

	it("stacks vertically with a grip handle", async () => {
		await render(
			<ResizableGroup direction="vertical" handle="grip" variant="outline">
				<ResizablePanel>
					<Text>{LEFT}</Text>
				</ResizablePanel>
				<ResizablePanel>
					<Text>{RIGHT}</Text>
				</ResizablePanel>
			</ResizableGroup>,
		);
		expect(screen.getByLabelText("Resize panel 1 and panel 2")).toHaveProp("accessibilityValue", { min: 0, max: 100, now: 50 });
	});
});
