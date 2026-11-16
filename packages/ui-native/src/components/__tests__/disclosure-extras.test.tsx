import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

const ANSWER = "Answer";
const BADGE = "New";
const LEADING = "tile";

describe("CollapsibleTrigger extras", () => {
	it("draws leading and trailing parts, a description, a plus indicator and an open tint", async () => {
		const onOpenChange = jest.fn();
		const view = await render(
			<Collapsible open={false} onOpenChange={onOpenChange} variant="inset">
				<CollapsibleTrigger
					label="Billing"
					description="Plans and invoices"
					leading={<Text>{LEADING}</Text>}
					trailing={<Text>{BADGE}</Text>}
					indicator="plus"
					openClassName="bg-muted"
					testID="trigger"
				/>
				<CollapsibleContent>
					<Text>{ANSWER}</Text>
				</CollapsibleContent>
			</Collapsible>,
		);
		expect(screen.getByText("Plans and invoices")).toBeOnTheScreen();
		expect(screen.getByText(LEADING)).toBeOnTheScreen();
		expect(screen.getByText(BADGE)).toBeOnTheScreen();
		expect(screen.getByTestId("trigger")).toHaveProp("className", expect.not.stringContaining("bg-muted"));
		await fireEvent.press(screen.getByRole("button", { name: "Billing" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		await view.rerender(
			<Collapsible open onOpenChange={onOpenChange} variant="inset">
				<CollapsibleTrigger label="Billing" indicator="chevron-start" openClassName="bg-muted" testID="trigger" />
				<CollapsibleContent>
					<Text>{ANSWER}</Text>
				</CollapsibleContent>
			</Collapsible>,
		);
		expect(screen.getByTestId("trigger")).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(screen.getByText(ANSWER)).toBeOnTheScreen();
	});
});

describe("Accordion outlined", () => {
	it("frames the items in one box, ruled apart", async () => {
		await render(
			<Accordion value={["a"]} onChange={jest.fn()} variant="outlined" testID="accordion">
				<AccordionItem value="a" testID="item">
					<AccordionTrigger label="First" />
					<AccordionContent>
						<Text>{ANSWER}</Text>
					</AccordionContent>
				</AccordionItem>
			</Accordion>,
		);
		expect(screen.getByTestId("accordion")).toHaveProp("className", expect.stringContaining("border-x"));
		expect(screen.getByTestId("item")).toHaveProp("className", expect.stringContaining("border-t"));
	});
});

describe("Tabs extras", () => {
	it("stacks a vertical list beside the panels, hugs labels, and reads badges", async () => {
		const onChange = jest.fn();
		await render(
			<Tabs value="inbox" onChange={onChange} orientation="vertical" variant="line" fill={false} testID="tabs">
				<TabsList testID="list">
					<TabsTrigger value="inbox" label="Inbox" badge="12" testID="inbox" />
					<TabsTrigger value="sent" label="Sent" />
				</TabsList>
				<TabsContent value="inbox">
					<Text>{ANSWER}</Text>
				</TabsContent>
			</Tabs>,
		);
		expect(screen.getByTestId("tabs")).toHaveProp("className", expect.stringContaining("flex-row"));
		expect(screen.getByTestId("list")).toHaveProp("className", expect.stringContaining("border-r"));
		expect(screen.getByTestId("inbox")).toHaveProp("className", expect.stringContaining("border-r-2"));
		expect(screen.getByRole("tab", { name: "Inbox, 12" })).toBeSelected();
		await fireEvent.press(screen.getByRole("tab", { name: "Sent" }));
		expect(onChange).toHaveBeenCalledWith("sent");
	});
});
