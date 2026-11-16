import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";
import { type Metrics, SafeAreaProvider } from "react-native-safe-area-context";

import { SHEET_MOTION } from "../../lib/motion";
import { Drawer, Sheet } from "../sheet";

const BODY = "Body text";

/** A phone with a notch and a home indicator: the sheet pads its edge inside them. */
const PHONE_METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } };

function onPhone(sheet: React.JSX.Element): React.JSX.Element {
	return <SafeAreaProvider initialMetrics={PHONE_METRICS}>{sheet}</SafeAreaProvider>;
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("Sheet", () => {
	it("shows its title, description, body and footer, and closes from its button or backdrop", async () => {
		const onOpenChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(
			onPhone(
				<Sheet
					ref={ref}
					open
					onOpenChange={onOpenChange}
					title="Edit profile"
					description="Make changes here."
					footer={<Text>Footer</Text>}
					side="left"
					size="lg"
					testID="sheet">
					<Text>{BODY}</Text>
				</Sheet>,
			),
		);
		expect(screen.getByRole("header", { name: "Edit profile" })).toBeOnTheScreen();
		expect(screen.getByText("Make changes here.")).toBeOnTheScreen();
		expect(screen.getByText("Footer")).toBeOnTheScreen();
		expect(screen.getByTestId("sheet")).toHaveProp("className", expect.stringContaining("left-0"));
		await fireEvent.press(screen.getByRole("button", { name: "Close edit profile" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		await fireEvent.press(screen.getByTestId("sheet-backdrop", { includeHiddenElements: true }));
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(ref.current).not.toBeNull();
	});

	it("leaves the screen once closed, after its exit", async () => {
		const view = await render(
			onPhone(
				<Sheet open onOpenChange={jest.fn()} title="Filters" showCloseButton={false}>
					<Text>{BODY}</Text>
				</Sheet>,
			),
		);
		expect(screen.queryByRole("button", { name: "Close filters" })).toBeNull();
		await view.rerender(
			onPhone(
				<Sheet open={false} onOpenChange={jest.fn()} title="Filters">
					<Text>{BODY}</Text>
				</Sheet>,
			),
		);
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.queryByText(BODY)).toBeNull();
	});

	it("closes a drawer swiped past a third of its size, and springs back short of it", async () => {
		const onOpenChange = jest.fn();
		await render(
			onPhone(
				<Drawer open onOpenChange={onOpenChange} title="Move goal" testID="drawer">
					<Text>{BODY}</Text>
				</Drawer>,
			),
		);
		const panel = screen.getByTestId("drawer");
		await fireEvent(panel, "layout", { nativeEvent: { layout: { width: 390, height: 300 } } });
		await fireEvent(panel, "startShouldSetResponderCapture", { nativeEvent: { pageX: 0, pageY: 100 } });
		await fireEvent(panel, "responderMove", { nativeEvent: { pageX: 0, pageY: 140 } });
		await fireEvent(panel, "responderRelease");
		expect(onOpenChange).not.toHaveBeenCalled();
		await fireEvent(panel, "responderMove", { nativeEvent: { pageX: 0, pageY: 250 } });
		await fireEvent(panel, "responderRelease");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
