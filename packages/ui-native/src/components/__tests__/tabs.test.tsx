import { fireEvent, render, screen } from "@testing-library/react-native";
import ActivityIcon from "lucide-react-native/icons/activity";
import * as React from "react";
import { Text, type View } from "react-native";
import { z } from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger, type TabsProps } from "../tabs";

function tabs(overrides: Partial<TabsProps> = {}): React.JSX.Element {
	return (
		<Tabs value="overview" onChange={jest.fn()} testID="tabs" {...overrides}>
			<TabsList accessibilityLabel="Project sections" testID="list">
				<TabsTrigger value="overview" label="Overview" testID="tab-overview" />
				<TabsTrigger value="activity" label="Activity" icon={ActivityIcon} testID="tab-activity" />
				<TabsTrigger value="billing" label="Billing" disabled />
			</TabsList>
			<TabsContent value="overview">
				<Text className="font-sans">Overview panel</Text>
			</TabsContent>
			<TabsContent value="activity">
				<Text className="font-sans">Activity panel</Text>
			</TabsContent>
		</Tabs>
	);
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("Tabs", () => {
	it("is a tablist of tabs that announce which one is selected", async () => {
		await render(tabs());

		expect(screen.getByTestId("list")).toHaveProp("accessibilityRole", "tablist");
		expect(screen.getByTestId("list")).toHaveProp("accessibilityLabel", "Project sections");
		expect(screen.getByRole("tab", { name: "Overview" })).toBeSelected();
		expect(screen.getByRole("tab", { name: "Activity" })).not.toBeSelected();
	});

	it("renders only the selected tab's content", async () => {
		await render(tabs({ value: "activity" }));

		expect(screen.getByText("Activity panel")).toBeOnTheScreen();
		expect(screen.queryByText("Overview panel")).toBeNull();
	});

	it("reports another tab's value, and stays quiet for the selected one", async () => {
		const onChange = jest.fn();
		await render(tabs({ onChange }));

		await fireEvent.press(screen.getByRole("tab", { name: "Overview" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("tab", { name: "Activity" }));
		expect(onChange).toHaveBeenCalledWith("activity");
	});

	it("blocks a disabled tab, and every tab while the tabs are disabled", async () => {
		const onChange = jest.fn();
		const view = await render(tabs({ onChange }));
		const billing = screen.getByRole("tab", { name: "Billing" });
		expect(billing).toBeDisabled();
		await fireEvent.press(billing);
		expect(onChange).not.toHaveBeenCalled();

		await view.rerender(tabs({ onChange, disabled: true }));
		expect(screen.getByRole("tab", { name: "Activity" })).toBeDisabled();
		expect(classNameOf("list")).toContain("opacity-60");
	});

	it.each([
		["default", "bg-muted", "bg-card"],
		["line", "border-b", "border-primary"],
	] satisfies [TabsProps["variant"], string, string][])("draws the %s look", async (variant, list, selected) => {
		await render(tabs({ variant }));

		expect(classNameOf("list")).toContain(list);
		expect(classNameOf("tab-overview")).toContain(selected);
		expect(classNameOf("tab-activity")).not.toContain(selected);
	});

	it.each([
		["md", "text-sm"],
		["sm", "text-xs"],
	] satisfies [TabsProps["size"], string][])("has a %s size", async (size, label) => {
		await render(tabs({ size }));
		expect(screen.getByText("Overview")).toHaveProp("className", expect.stringContaining(label));
	});

	it("forwards refs from every part and merges the caller's className last", async () => {
		const root = React.createRef<View>();
		const list = React.createRef<View>();
		const trigger = React.createRef<View>();
		const content = React.createRef<View>();
		await render(
			<Tabs ref={root} value="a" onChange={jest.fn()} className="gap-6" testID="tabs">
				<TabsList ref={list} className="p-0" testID="list">
					<TabsTrigger ref={trigger} value="a" label="A" className="px-6" testID="tab" />
				</TabsList>
				<TabsContent ref={content} value="a" className="gap-1" testID="panel">
					<Text className="font-sans">A panel</Text>
				</TabsContent>
			</Tabs>,
		);

		expect(root.current).not.toBeNull();
		expect(list.current).not.toBeNull();
		expect(trigger.current).not.toBeNull();
		expect(content.current).not.toBeNull();
		expect(classNameOf("tabs")).toContain("gap-6");
		expect(classNameOf("tabs")).not.toContain("gap-3");
		expect(classNameOf("list")).toContain("p-0");
		expect(classNameOf("list").split(" ")).not.toContain("p-1");
		expect(classNameOf("tab")).toContain("px-6");
		expect(classNameOf("tab")).not.toContain("px-3");
		expect(classNameOf("panel")).toContain("gap-1");
	});

	it("refuses parts rendered outside Tabs", async () => {
		jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(render(<TabsTrigger value="a" label="A" />)).rejects.toThrow("TabsTrigger must be rendered inside Tabs.");
	});
});
