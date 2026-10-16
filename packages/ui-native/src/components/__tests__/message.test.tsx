import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type View } from "react-native";

import { Bubble } from "../bubble";
import { Message } from "../message";

describe("Message", () => {
	it("shows the avatar, the author, the bubbles and the caller's timestamp", async () => {
		await render(
			<Message author="Alex Morgan" timestamp="09:41" avatar={<Text className="font-sans">AM</Text>} testID="message">
				<Bubble text="See you at noon?" />
			</Message>,
		);

		expect(screen.getByText("AM")).toBeOnTheScreen();
		expect(screen.getByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.getByText("See you at noon?")).toBeOnTheScreen();
		expect(screen.getByText("09:41")).toHaveProp("className", expect.stringContaining("font-sans"));
	});

	it("reads from the leading edge when received, and mirrors when sent", async () => {
		await render(
			<Message testID="received">
				<Bubble text="Hello" />
			</Message>,
		);
		expect(screen.getByTestId("received")).toHaveProp("className", expect.stringContaining("flex-row"));
		expect(screen.getByTestId("received")).not.toHaveProp("className", expect.stringContaining("flex-row-reverse"));

		await render(
			<Message variant="sent" testID="sent">
				<Bubble variant="sent" text="Hi!" />
			</Message>,
		);
		expect(screen.getByTestId("sent")).toHaveProp("className", expect.stringContaining("flex-row-reverse"));
	});

	it("leaves out the parts the caller does not give", async () => {
		await render(
			<Message>
				<Bubble text="Only the bubble" />
			</Message>,
		);
		expect(screen.getByText("Only the bubble")).toBeOnTheScreen();
		expect(screen.queryByText("09:41")).toBeNull();
	});

	it("has a compact size", async () => {
		await render(
			<Message size="sm" testID="message">
				<Bubble text="Dense" />
			</Message>,
		);
		expect(screen.getByTestId("message")).toHaveProp("className", expect.stringContaining("gap-1.5"));
	});

	it("merges the caller's className last", async () => {
		await render(
			<Message className="gap-4 px-4" testID="message">
				<Bubble text="Spaced" />
			</Message>,
		);
		const className = String(screen.getByTestId("message").props.className);
		expect(className).toContain("px-4");
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(
			<Message ref={ref}>
				<Bubble text="Ref" />
			</Message>,
		);
		expect(ref.current).not.toBeNull();
	});
});
