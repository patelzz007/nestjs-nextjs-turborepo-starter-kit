import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";
import type * as Reanimated from "react-native-reanimated";

import { TOGGLE_MARK_MS } from "../../lib/motion";
import { Checkbox } from "../checkbox";
import { ToggleMark, ToggleMarkScope } from "../toggle-mark";

let mockReducedMotion = false;

jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<typeof Reanimated>("react-native-reanimated"),
	__esModule: true,
	useReducedMotion: (): boolean => mockReducedMotion,
}));

afterEach(() => {
	mockReducedMotion = false;
});

describe("ToggleMark", () => {
	it("draws what it marks, inside the scope that keeps a first draw still", async () => {
		await render(
			<ToggleMarkScope>
				<ToggleMark>
					<Text>tick</Text>
				</ToggleMark>
			</ToggleMarkScope>,
		);
		expect(screen.getByText("tick")).toBeOnTheScreen();
	});

	it("pops in with an entrance when motion is on", async () => {
		await render(
			<ToggleMark>
				<Text>tick</Text>
			</ToggleMark>,
		);
		expect(screen.container.queryAll((element) => element.props.entering !== undefined).length).toBeGreaterThan(0);
	});

	it("appears at once under Reduce Motion, with no entrance that could leave it invisible", async () => {
		mockReducedMotion = true;
		await render(
			<ToggleMark>
				<Text>tick</Text>
			</ToggleMark>,
		);
		expect(screen.container.queryAll((element) => element.props.entering !== undefined)).toHaveLength(0);
		expect(screen.getByText("tick")).toBeOnTheScreen();
	});

	it("pops in quicker than a page changes, and leaves quicker still", () => {
		expect(TOGGLE_MARK_MS.exit).toBeLessThan(TOGGLE_MARK_MS.enter);
	});

	it("puts the tick in and takes it out as the checkbox changes", async () => {
		const view = await render(<Checkbox label="Email" checked={false} onChange={jest.fn()} />);
		// The tick is part of the checkbox's one accessible element, so it is queried as hidden.
		const tick = { includeHiddenElements: true };
		expect(screen.queryByTestId("checkbox-tick", tick)).toBeNull();
		await view.rerender(<Checkbox label="Email" checked onChange={jest.fn()} />);
		expect(screen.getByTestId("checkbox-tick", tick)).toBeOnTheScreen();
		await view.rerender(<Checkbox label="Email" checked={false} onChange={jest.fn()} />);
		expect(screen.queryByTestId("checkbox-tick", tick)).toBeNull();
	});
});
