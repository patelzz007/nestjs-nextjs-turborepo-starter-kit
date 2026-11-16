import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, framePanelPlacements, FrameTitle } from "../frame";

const TITLE = "Section header";
const DESCRIPTION = "Description for the section";

function classesOf(testID: string): readonly string[] {
	return String(screen.getByTestId(testID).props.className).split(" ");
}

describe("framePanelPlacements", () => {
	it("joins runs of adjacent panels into a column when stacked", () => {
		expect(framePanelPlacements([false, true, true, true], true)).toStrictEqual([
			null,
			{ position: "first", spaced: false },
			{ position: "middle", spaced: false },
			{ position: "last", spaced: false },
		]);
		expect(framePanelPlacements([true], true)).toStrictEqual([{ position: "only", spaced: false }]);
	});

	it("spaces each panel after another when not stacked", () => {
		expect(framePanelPlacements([false, true, true], false)).toStrictEqual([null, { position: "only", spaced: false }, { position: "only", spaced: true }]);
	});
});

describe("Frame", () => {
	it("lays out a title bar, panels and a footer on a muted tray", async () => {
		await render(
			<Frame testID="frame">
				<FrameHeader>
					<FrameTitle>{TITLE}</FrameTitle>
					<FrameDescription>{DESCRIPTION}</FrameDescription>
				</FrameHeader>
				<FramePanel testID="panel">
					<Text>Body</Text>
				</FramePanel>
				<FrameFooter testID="footer">
					<Text>Footer</Text>
				</FrameFooter>
			</Frame>,
		);
		expect(screen.getByRole("header", { name: TITLE })).toBeOnTheScreen();
		expect(classesOf("frame")).toContain("bg-muted/50");
		expect(classesOf("frame")).toContain("border-border");
		// One radius step inside the tray's corner, and the spacing's padding.
		expect(classesOf("panel")).toContain("rounded-lg");
		expect(classesOf("panel")).toContain("p-4");
		expect(classesOf("footer")).toContain("py-2");
	});

	it("joins stacked panels with shared borders", async () => {
		await render(
			<Frame stacked>
				<FramePanel testID="top" />
				<FramePanel testID="bottom" />
			</Frame>,
		);
		expect(classesOf("top")).toContain("rounded-b-none");
		expect(classesOf("bottom")).toContain("rounded-t-none");
		expect(classesOf("bottom")).toContain("border-t-0");
	});

	it("sets flush panels on the tray's own corner when dense, and follows spacing, radius and variant", async () => {
		const view = await render(
			<Frame dense radius="2xl" testID="frame">
				<FramePanel testID="panel" />
			</Frame>,
		);
		expect(classesOf("frame")).toContain("p-0");
		expect(classesOf("panel")).toContain("rounded-2xl");
		await view.rerender(
			<Frame variant="ghost" spacing="xs" radius="sm" testID="frame">
				<FramePanel fit testID="panel" />
			</Frame>,
		);
		expect(classesOf("frame")).not.toContain("border");
		expect(classesOf("panel")).toContain("p-2");
		expect(classesOf("panel")).toContain("rounded-xs");
		expect(classesOf("panel")).not.toContain("grow");
	});

	it("spaces separate panels by the spacing's gap", async () => {
		await render(
			<Frame spacing="lg">
				<FramePanel testID="first" />
				<FramePanel testID="second" />
			</Frame>,
		);
		expect(classesOf("first")).not.toContain("mt-2");
		expect(classesOf("second")).toContain("mt-2");
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Frame ref={ref} className="w-full" testID="frame" />);
		expect(ref.current).not.toBeNull();
		expect(classesOf("frame").at(-1)).toBe("w-full");
	});
});
