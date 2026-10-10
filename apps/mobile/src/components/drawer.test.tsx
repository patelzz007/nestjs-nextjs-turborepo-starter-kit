import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { BackHandler, Text, type HardwareBackPressEvent, type NativeEventSubscription } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { Drawer, type DrawerProps } from "./drawer";

/** A phone-sized frame: SafeAreaProvider renders nothing until it knows the metrics. */
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

interface Handlers {
	readonly onOpen: jest.Mock;
	readonly onClose: jest.Mock;
}

function handlers(): Handlers {
	return { onOpen: jest.fn(), onClose: jest.fn() };
}

function drawer(open: boolean, { onOpen, onClose }: Handlers, overrides: Partial<Pick<DrawerProps, "swipeEnabled">> = {}): React.JSX.Element {
	return (
		<SafeAreaProvider initialMetrics={METRICS}>
			<Drawer
				open={open}
				onOpen={onOpen}
				onClose={onClose}
				accessibilityLabel="Menu"
				closeLabel="Close menu"
				panel={<Text>Panel content</Text>}
				testID="drawer"
				{...overrides}>
				<Text>App content</Text>
			</Drawer>
		</SafeAreaProvider>
	);
}

describe("Drawer", () => {
	it("keeps a closed drawer away from screen readers and touches, and the app reachable", async () => {
		await render(drawer(false, handlers()));

		expect(screen.getByText("App content")).toBeOnTheScreen();
		expect(screen.queryByText("Panel content")).toBeNull();
		expect(screen.getByTestId("drawer-panel", { includeHiddenElements: true })).toHaveProp("pointerEvents", "none");
	});

	it("shows an open drawer as a modal panel and hides the app from screen readers", async () => {
		await render(drawer(true, handlers()));

		expect(screen.getByText("Panel content")).toBeOnTheScreen();
		expect(screen.queryByText("App content")).toBeNull();
		expect(screen.getByTestId("drawer-panel")).toHaveProp("accessibilityViewIsModal", true);
		expect(screen.getByTestId("drawer-panel")).toHaveAccessibleName("Menu");
	});

	it("closes from the scrim (a touch target; screen readers close with the escape gesture instead)", async () => {
		const drawerHandlers = handlers();
		await render(drawer(true, drawerHandlers));

		await fireEvent.press(screen.getByTestId("drawer-scrim", { includeHiddenElements: true }));

		expect(drawerHandlers.onClose).toHaveBeenCalledTimes(1);
	});

	it("closes from the screen reader's escape gesture", async () => {
		const drawerHandlers = handlers();
		await render(drawer(true, drawerHandlers));

		await fireEvent(screen.getByTestId("drawer-content"), "accessibilityEscape");

		expect(drawerHandlers.onClose).toHaveBeenCalledTimes(1);
	});

	it("takes the Android back button only while open, and lets go of it once closed", async () => {
		let pressBack: ((event: HardwareBackPressEvent) => boolean | null | undefined) | null = null;
		const remove = jest.fn();
		const subscribe = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler): NativeEventSubscription => {
			pressBack = handler;
			return { remove };
		});
		const drawerHandlers = handlers();
		const view = await render(drawer(false, drawerHandlers));
		expect(subscribe).not.toHaveBeenCalled();

		await view.rerender(drawer(true, drawerHandlers));
		expect(subscribe).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
		let handled: boolean | null | undefined = false;
		await act((): void => {
			handled = pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
		});
		expect(handled).toBe(true);
		expect(drawerHandlers.onClose).toHaveBeenCalledTimes(1);

		await view.rerender(drawer(false, drawerHandlers));
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it("offers the edge swipe only while closed and enabled", async () => {
		const view = await render(drawer(false, handlers()));
		expect(screen.getByTestId("drawer-edge", { includeHiddenElements: true })).toBeOnTheScreen();

		await view.rerender(drawer(false, handlers(), { swipeEnabled: false }));
		expect(screen.queryByTestId("drawer-edge", { includeHiddenElements: true })).toBeNull();

		await view.rerender(drawer(true, handlers()));
		expect(screen.queryByTestId("drawer-edge", { includeHiddenElements: true })).toBeNull();
	});
});
