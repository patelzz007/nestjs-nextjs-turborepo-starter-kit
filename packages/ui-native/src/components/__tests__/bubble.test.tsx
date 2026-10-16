import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type View } from "react-native";

import { Bubble } from "../bubble";

describe("Bubble", () => {
	it("is a muted bubble at the leading edge by default, with matching, selectable text", async () => {
		await render(<Bubble text="See you at the café" testID="bubble" />);

		const className = String(screen.getByTestId("bubble").props.className);
		expect(className).toContain("bg-muted");
		expect(className).toContain("self-start");
		const text = screen.getByText("See you at the café");
		expect(text).toHaveProp("className", expect.stringContaining("text-foreground"));
		expect(text).toHaveProp("className", expect.stringContaining("font-sans"));
		expect(text).toHaveProp("selectable", true);
	});

	it("is a primary bubble at the trailing edge when sent, and its text follows", async () => {
		await render(<Bubble variant="sent" text="On my way!" testID="bubble" />);

		const className = String(screen.getByTestId("bubble").props.className);
		expect(className).toContain("bg-primary");
		expect(className).toContain("self-end");
		expect(screen.getByText("On my way!")).toHaveProp("className", expect.stringContaining("text-primary-foreground"));
	});

	it("shows other content after its text", async () => {
		await render(
			<Bubble text="Here is the file">
				<Text className="font-sans">report.pdf</Text>
			</Bubble>,
		);
		expect(screen.getByText("Here is the file")).toBeOnTheScreen();
		expect(screen.getByText("report.pdf")).toBeOnTheScreen();
	});

	it("has a compact size for its padding and text", async () => {
		await render(<Bubble size="sm" text="ok" testID="bubble" />);
		expect(screen.getByTestId("bubble")).toHaveProp("className", expect.stringContaining("py-1.5"));
		expect(screen.getByText("ok")).toHaveProp("className", expect.stringContaining("text-sm"));
	});

	it("takes an accessible name for the whole bubble", async () => {
		await render(<Bubble accessibilityLabel="Alex said: running late" text="running late" testID="bubble" />);
		expect(screen.getByTestId("bubble")).toHaveAccessibleName("Alex said: running late");
	});

	it("merges the caller's classNames last", async () => {
		await render(<Bubble text="Wide" className="max-w-full rounded-lg" textClassName="text-lg" testID="bubble" />);
		const className = String(screen.getByTestId("bubble").props.className);
		expect(className).toContain("max-w-full");
		expect(className).not.toContain("max-w-4/5");
		expect(className).not.toContain("rounded-2xl");
		expect(screen.getByText("Wide")).toHaveProp("className", expect.stringContaining("text-lg"));
		expect(screen.getByText("Wide")).not.toHaveProp("className", expect.stringContaining("text-base"));
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(<Bubble ref={ref} text="Hi" />);
		expect(ref.current).not.toBeNull();
	});
});
