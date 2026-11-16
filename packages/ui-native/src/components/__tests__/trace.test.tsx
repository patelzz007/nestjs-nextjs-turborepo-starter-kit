import { fireEvent, render, screen } from "@testing-library/react-native";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Trace, TraceLine, traceLineLabelOf, TraceStep } from "../trace";

/** The utility classes on an element, one by one. */
function classesOf(testID: string): readonly string[] {
	return String(screen.getByTestId(testID).props.className).split(" ");
}

describe("Trace", () => {
	it("lists its steps, named for screen readers", async () => {
		await render(
			<Trace accessibilityLabel="Agent steps" testID="trace">
				<TraceLine icon={SearchIcon} title="Searched the codebase" description="3 results" />
			</Trace>,
		);
		expect(screen.getByTestId("trace")).toHaveProp("accessibilityLabel", "Agent steps");
		expect(screen.getByLabelText("Searched the codebase, 3 results")).toBeOnTheScreen();
	});
});

describe("TraceLine", () => {
	it("is named by its title and description", () => {
		expect(traceLineLabelOf("Ran tests", "12 passed")).toBe("Ran tests, 12 passed");
		expect(traceLineLabelOf("Ran tests", undefined)).toBe("Ran tests");
	});

	it("tints a failed step destructive and dims a pending one", async () => {
		const view = await render(<TraceLine title="Lint failed" status="error" testID="line" />);
		expect(screen.getByText("Lint failed")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
		await view.rerender(<TraceLine title="Deploy" status="pending" testID="line" />);
		expect(classesOf("line")).toContain("opacity-60");
	});

	it("shows a running step's title", async () => {
		await render(<TraceLine title="Removing the unused nonce" status="running" />);
		expect(screen.getByText("Removing the unused nonce")).toHaveProp("className", expect.stringContaining("text-foreground"));
	});

	it("is a button with onPress, or a link when it says so", async () => {
		const onPress = jest.fn();
		const view = await render(<TraceLine title="Open logs" onPress={onPress} />);
		await fireEvent.press(screen.getByRole("button", { name: "Open logs" }));
		expect(onPress).toHaveBeenCalledTimes(1);
		await view.rerender(<TraceLine title="Open site" onPress={onPress} accessibilityRole="link" />);
		expect(screen.getByRole("link", { name: "Open site" })).toBeOnTheScreen();
	});

	it("ends in a glyph of the caller's after its description", async () => {
		await render(<TraceLine title="Activation funnel" trailingIcon={SearchIcon} onPress={jest.fn()} accessibilityRole="link" />);
		expect(screen.getByRole("link", { name: "Activation funnel" })).toBeOnTheScreen();
	});

	it("ends in anything of the caller's after its description", async () => {
		await render(<TraceLine title="payments.createIntent" description="610 ms" trailing={<Text>71%</Text>} />);
		expect(screen.getByText("71%")).toBeOnTheScreen();
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<TraceLine ref={ref} title="Step" className="mt-2" testID="line" />);
		expect(ref.current).not.toBeNull();
		expect(classesOf("line").at(-1)).toBe("mt-2");
	});
});

describe("TraceStep", () => {
	it("opens and closes its detail by itself, announcing whether it is open", async () => {
		await render(
			<TraceStep title="Edited csp.ts" description="+2 -1">
				<Text>The patch</Text>
			</TraceStep>,
		);
		const trigger = screen.getByRole("button", { name: "Edited csp.ts, +2 -1" });
		expect(trigger).toBeCollapsed();
		expect(screen.queryByText("The patch")).toBeNull();
		await fireEvent.press(trigger);
		expect(screen.getByText("The patch")).toBeOnTheScreen();
		expect(trigger).toBeExpanded();
	});

	it("starts open with defaultOpen", async () => {
		await render(
			<TraceStep title="Ran tests" defaultOpen>
				<Text>12 passed</Text>
			</TraceStep>,
		);
		expect(screen.getByText("12 passed")).toBeOnTheScreen();
	});

	it("follows its owner when controlled", async () => {
		const onOpenChange = jest.fn();
		const view = await render(
			<TraceStep title="Build" open={false} onOpenChange={onOpenChange}>
				<Text>Log</Text>
			</TraceStep>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Build" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(screen.queryByText("Log")).toBeNull();
		await view.rerender(
			<TraceStep title="Build" open onOpenChange={onOpenChange}>
				<Text>Log</Text>
			</TraceStep>,
		);
		expect(screen.getByText("Log")).toBeOnTheScreen();
	});

	it("is a done step by default, with no test ids of its own", async () => {
		await render(
			<TraceStep title="Ran the tests">
				<Text>12 passed</Text>
			</TraceStep>,
		);
		expect(screen.getByRole("button", { name: "Ran the tests" })).toBeOnTheScreen();
	});
});
