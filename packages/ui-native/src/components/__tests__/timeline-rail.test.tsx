import { render, screen } from "@testing-library/react-native";
import TagIcon from "lucide-react-native/icons/tag";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { TimelineRailIcon, TimelineRailItem, type TimelineRailTone } from "../timeline-rail";

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

	it("centres a compact entry on its node, and has a dense size", async () => {
		await render(
			<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} compact size="sm" testID="entry">
				<Text>labelled</Text>
			</TimelineRailItem>,
		);

		const className = String(screen.getByTestId("entry-content").props.className);
		expect(className).toContain("justify-center");
		expect(className).toContain("pb-3");
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<TimelineRailItem ref={ref} node={<TimelineRailIcon icon={TagIcon} />} className="gap-4" testID="entry">
				<Text>entry</Text>
			</TimelineRailItem>,
		);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("entry").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-3");
	});
});

describe("TimelineRailIcon", () => {
	it.each([
		["neutral", "bg-muted"],
		["success", "bg-success"],
		["danger", "bg-destructive"],
		["attention", "bg-warning-soft"],
		["done", "bg-tone-violet"],
	] satisfies readonly (readonly [TimelineRailTone, string])[])("fills the %s disc with its token", async (tone, fill) => {
		await render(<TimelineRailIcon icon={TagIcon} tone={tone} testID="disc" />);
		expect(screen.getByTestId("disc", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining(fill));
	});

	it("has a small size, forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<TimelineRailIcon ref={ref} icon={TagIcon} size="sm" className="size-7" testID="disc" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("disc").props.className);
		expect(className).toContain("size-7");
		expect(className).not.toContain("size-6");
	});
});
