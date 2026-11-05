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

	it("draws a connector below each node but the last, and never one above the first (ReUI's timeline)", async () => {
		await render(
			<>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} testID="first">
					<Text>Opened</Text>
				</TimelineRailItem>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} isLast testID="last">
					<Text>Merged</Text>
				</TimelineRailItem>
			</>,
		);

		expect(screen.getByTestId("first-connector", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByTestId("last-connector", { includeHiddenElements: true })).toBeNull();
		// The connector comes after the node in its column: it starts below the node, so none shows above it.
		const column = screen.getByTestId("first-connector", { includeHiddenElements: true }).parent;
		expect(column?.children.at(-1)).toBe(screen.getByTestId("first-connector", { includeHiddenElements: true }));
	});

	it("centres the node on a list row, with the connector halves joining it to its neighbours only", async () => {
		await render(
			<>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} testID="first-node" />} align="center" isFirst testID="first">
					<Text>fix: the first commit</Text>
				</TimelineRailItem>
				<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} />} align="center" isLast testID="last">
					<Text>feat: the last commit</Text>
				</TimelineRailItem>
			</>,
		);

		const column = screen.getByTestId("first-node", { includeHiddenElements: true }).parent;
		expect(column?.props.className).toContain("justify-center");
		// Nothing above the first node, nothing below the last; the halves between them are drawn.
		expect(screen.getByTestId("first-connector-above", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("bg-transparent"));
		expect(screen.getByTestId("first-connector", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("bg-border"));
		expect(screen.getByTestId("last-connector-above", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("bg-border"));
		expect(screen.getByTestId("last-connector", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("bg-transparent"));
		expect(screen.getByTestId("first-content")).toHaveProp("className", expect.stringContaining("pb-0"));
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
