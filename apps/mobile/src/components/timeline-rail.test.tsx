import { render, screen } from "@testing-library/react-native";
import TagIcon from "lucide-react-native/icons/tag";
import * as React from "react";
import { Text } from "react-native";

import { TimelineRailIcon, TimelineRailItem } from "./timeline-rail";

describe("TimelineRailItem", () => {
	it("shows the entry beside its node, and keeps the decorative node from screen readers", async () => {
		await render(
			<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} testID="entry">
				<Text>octocat added the bug label</Text>
			</TimelineRailItem>,
		);

		expect(screen.getByText("octocat added the bug label")).toBeOnTheScreen();
		expect(screen.getByTestId("entry")).toBeOnTheScreen();
	});

	it("leaves room below every entry but the last, so the line runs on to the next", async () => {
		await render(
			<>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} testID="first">
					<Text>first</Text>
				</TimelineRailItem>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} tone="success" />} isLast testID="last">
					<Text>last</Text>
				</TimelineRailItem>
			</>,
		);

		expect(screen.getByTestId("first-content")).toHaveProp("className", expect.stringContaining("pb-5"));
		expect(screen.getByTestId("last-content")).toHaveProp("className", expect.not.stringContaining("pb-5"));
	});
});
