import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";
import { z } from "zod";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, nextAccordionValue, type AccordionProps } from "../accordion";

function accordion(overrides: Partial<AccordionProps> = {}): React.JSX.Element {
	return (
		<Accordion value={[]} onChange={jest.fn()} testID="accordion" {...overrides}>
			<AccordionItem value="billing" testID="item-billing">
				<AccordionTrigger label="Billing" />
				<AccordionContent>
					<Text className="font-sans">Invoices go out on the 1st.</Text>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="security" testID="item-security">
				<AccordionTrigger label="Security" />
				<AccordionContent>
					<Text className="font-sans">Two-factor is required.</Text>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="legacy" disabled>
				<AccordionTrigger label="Legacy" />
				<AccordionContent>
					<Text className="font-sans">Retired.</Text>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("nextAccordionValue", () => {
	it("single: opens an item alone, and closes it again only when collapsible", () => {
		expect(nextAccordionValue([], "a", "single", true)).toEqual(["a"]);
		expect(nextAccordionValue(["a"], "b", "single", true)).toEqual(["b"]);
		expect(nextAccordionValue(["a"], "a", "single", true)).toEqual([]);
		expect(nextAccordionValue(["a"], "a", "single", false)).toEqual(["a"]);
	});

	it("multiple: toggles one item and leaves the others", () => {
		expect(nextAccordionValue(["a"], "b", "multiple", true)).toEqual(["a", "b"]);
		expect(nextAccordionValue(["a", "b"], "a", "multiple", true)).toEqual(["b"]);
	});
});

describe("Accordion", () => {
	it("shows only the open items, and announces which are expanded", async () => {
		await render(accordion({ value: ["security"] }));

		expect(screen.getByRole("button", { name: "Billing" })).toHaveProp("accessibilityState", expect.objectContaining({ expanded: false }));
		expect(screen.getByRole("button", { name: "Security" })).toHaveProp("accessibilityState", expect.objectContaining({ expanded: true }));
		expect(screen.queryByText("Invoices go out on the 1st.")).toBeNull();
		expect(screen.getByText("Two-factor is required.")).toBeOnTheScreen();
	});

	it("single: reports the next open item, closing the current one", async () => {
		const onChange = jest.fn();
		await render(accordion({ value: ["security"], onChange }));

		await fireEvent.press(screen.getByRole("button", { name: "Billing" }));
		expect(onChange).toHaveBeenLastCalledWith(["billing"]);

		await fireEvent.press(screen.getByRole("button", { name: "Security" }));
		expect(onChange).toHaveBeenLastCalledWith([]);
	});

	it("single, not collapsible: the open item stays open", async () => {
		const onChange = jest.fn();
		await render(accordion({ value: ["security"], onChange, collapsible: false }));

		await fireEvent.press(screen.getByRole("button", { name: "Security" }));
		expect(onChange).toHaveBeenLastCalledWith(["security"]);
	});

	it("multiple: opens items alongside each other", async () => {
		const onChange = jest.fn();
		await render(accordion({ value: ["security"], onChange, type: "multiple" }));

		await fireEvent.press(screen.getByRole("button", { name: "Billing" }));
		expect(onChange).toHaveBeenLastCalledWith(["security", "billing"]);
	});

	it("blocks a disabled item, and every item while the accordion is disabled", async () => {
		const onChange = jest.fn();
		const view = await render(accordion({ onChange }));
		expect(screen.getByRole("button", { name: "Legacy" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Legacy" }));
		expect(onChange).not.toHaveBeenCalled();

		await view.rerender(accordion({ onChange, disabled: true }));
		expect(screen.getByRole("button", { name: "Billing" })).toBeDisabled();
		expect(classNameOf("accordion")).toContain("opacity-60");
	});

	it.each([
		["default", "border-b"],
		["separated", "rounded-lg"],
	] satisfies [AccordionProps["variant"], string][])("draws its items in the %s variant", async (variant, expected) => {
		await render(accordion({ variant }));
		expect(classNameOf("item-billing")).toContain(expected);
	});

	it("forwards refs from every part and merges the caller's className last", async () => {
		const root = React.createRef<ViewInstance>();
		const item = React.createRef<ViewInstance>();
		const trigger = React.createRef<ViewInstance>();
		const content = React.createRef<ViewInstance>();
		await render(
			<Accordion ref={root} value={["faq"]} onChange={jest.fn()} animated={false} className="gap-4" testID="accordion">
				<AccordionItem ref={item} value="faq" className="border-b-0" testID="item">
					<AccordionTrigger ref={trigger} label="FAQ" />
					<AccordionContent ref={content}>
						<Text className="font-sans">Answers.</Text>
					</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);

		expect(root.current).not.toBeNull();
		expect(item.current).not.toBeNull();
		expect(trigger.current).not.toBeNull();
		expect(content.current).not.toBeNull();
		expect(classNameOf("accordion")).toContain("gap-4");
		expect(classNameOf("item")).toContain("border-b-0");
	});

	it("refuses an item rendered outside an Accordion", async () => {
		jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(
			render(
				<AccordionItem value="orphan">
					<AccordionTrigger label="Orphan" />
				</AccordionItem>,
			),
		).rejects.toThrow("AccordionItem must be rendered inside an Accordion.");
	});
});
