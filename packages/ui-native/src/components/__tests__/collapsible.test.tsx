import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Text, type View } from "react-native";
import { z } from "zod";

import { Collapsible, CollapsibleContent, CollapsibleTrigger, type CollapsibleProps } from "../collapsible";

function collapsible(overrides: Partial<CollapsibleProps> = {}): React.JSX.Element {
	return (
		<Collapsible open={false} onOpenChange={jest.fn()} testID="collapsible" {...overrides}>
			<CollapsibleTrigger label="Show details" accessibilityHint="Shows the build's steps" testID="trigger" />
			<CollapsibleContent testID="content">
				<Text className="font-sans">Install, build, test</Text>
			</CollapsibleContent>
		</Collapsible>
	);
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("Collapsible", () => {
	it("is a collapsed button that hides its content while closed", async () => {
		await render(collapsible());

		const trigger = screen.getByRole("button", { name: "Show details" });
		expect(trigger).toHaveProp("accessibilityState", expect.objectContaining({ expanded: false }));
		expect(trigger).toHaveProp("accessibilityHint", "Shows the build's steps");
		expect(screen.queryByText("Install, build, test")).toBeNull();
	});

	it("shows its content and announces expanded while open", async () => {
		await render(collapsible({ open: true }));

		expect(screen.getByRole("button", { name: "Show details" })).toHaveProp("accessibilityState", expect.objectContaining({ expanded: true }));
		expect(screen.getByText("Install, build, test")).toBeOnTheScreen();
	});

	it("asks to toggle from its trigger; the caller decides", async () => {
		const onOpenChange = jest.fn();
		const view = await render(collapsible({ onOpenChange }));

		await fireEvent.press(screen.getByRole("button", { name: "Show details" }));
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		expect(screen.queryByText("Install, build, test")).toBeNull();

		await view.rerender(collapsible({ onOpenChange, open: true }));
		await fireEvent.press(screen.getByRole("button", { name: "Show details" }));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("cannot be toggled while disabled, and shows no error styling then", async () => {
		const onOpenChange = jest.fn();
		const view = await render(collapsible({ onOpenChange, disabled: true, invalid: true, variant: "card" }));

		const trigger = screen.getByRole("button", { name: "Show details" });
		expect(trigger).toBeDisabled();
		await fireEvent.press(trigger);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(classNameOf("collapsible")).toContain("opacity-60");
		expect(classNameOf("collapsible")).not.toContain("border-destructive");

		await view.rerender(collapsible({ invalid: true, variant: "card" }));
		expect(classNameOf("collapsible")).toContain("border-destructive");
	});

	it.each([
		["plain", "pb-3"],
		["card", "px-4 pb-4"],
	] satisfies [CollapsibleProps["variant"], string][])("draws a %s variant", async (variant, content) => {
		await render(collapsible({ variant, open: true }));
		expect(classNameOf("content")).toContain(content);
	});

	it("fades its content in, and simply shows it under Reduce Motion or with animation off", async () => {
		await render(collapsible({ open: true }));
		expect(screen.getByTestId("content")).toHaveProp("entering", expect.anything());

		await render(collapsible({ open: true, animated: false }));
		expect(screen.getByTestId("content")).not.toHaveProp("entering");

		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(collapsible({ open: true }));
		expect(screen.getByTestId("content")).not.toHaveProp("entering");
	});

	it("forwards refs from every part and merges the caller's className last", async () => {
		const root = React.createRef<View>();
		const trigger = React.createRef<View>();
		const content = React.createRef<View>();
		await render(
			<Collapsible ref={root} open onOpenChange={jest.fn()} animated={false} className="gap-2" testID="collapsible">
				<CollapsibleTrigger ref={trigger} label="Details" className="py-1" testID="trigger" />
				<CollapsibleContent ref={content} className="pb-6" testID="content">
					<Text className="font-sans">Body</Text>
				</CollapsibleContent>
			</Collapsible>,
		);

		expect(root.current).not.toBeNull();
		expect(trigger.current).not.toBeNull();
		expect(content.current).not.toBeNull();
		expect(classNameOf("collapsible")).toContain("gap-2");
		expect(classNameOf("trigger")).toContain("py-1");
		expect(classNameOf("trigger")).not.toContain("py-3");
		expect(classNameOf("content")).toContain("pb-6");
		expect(classNameOf("content")).not.toContain("pb-3");
	});

	it("refuses parts rendered outside a Collapsible", async () => {
		jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(render(<CollapsibleTrigger label="Orphan" />)).rejects.toThrow("CollapsibleTrigger must be rendered inside a Collapsible.");
	});
});
