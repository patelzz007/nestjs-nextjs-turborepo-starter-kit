import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

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
		expect(screen.getByText("ok")).toHaveProp("className", expect.stringContaining("text-body"));
	});

	it("takes an accessible name for the whole bubble", async () => {
		await render(<Bubble accessibilityLabel="Alex said: running late" text="running late" testID="bubble" />);
		expect(screen.getByTestId("bubble")).toHaveAccessibleName("Alex said: running late");
	});

	it("merges the caller's classNames last", async () => {
		await render(<Bubble text="Wide" className="max-w-full rounded-lg" textClassName="text-h3" testID="bubble" />);
		const className = String(screen.getByTestId("bubble").props.className);
		expect(className).toContain("max-w-full");
		expect(className).not.toContain("max-w-4/5");
		expect(className).not.toContain("rounded-2xl");
		expect(screen.getByText("Wide")).toHaveProp("className", expect.stringContaining("text-h3"));
		expect(screen.getByText("Wide")).not.toHaveProp("className", expect.stringContaining("text-body-lg"));
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Bubble ref={ref} text="Hi" />);
		expect(ref.current).not.toBeNull();
	});
});

describe("Bubble tones, reactions and quick replies", () => {
	it("recolours with a tone, hangs reactions off its edge, and becomes a button with onPress", async () => {
		const choose = jest.fn();
		const { rerender } = await render(
			<Bubble
				text="Deploy failed"
				tone="destructive"
				testID="bubble"
				reactions={[
					{ key: "eyes", emoji: "👀", count: 2, label: "2 people reacted with eyes" },
					{ key: "ok", emoji: "👍", label: "You reacted with thumbs up" },
				]}
			/>,
		);
		expect(screen.getByTestId("bubble")).toHaveProp("className", expect.stringContaining("bg-destructive/10"));
		expect(screen.getByRole("image", { name: "2 people reacted with eyes" })).toBeOnTheScreen();
		expect(screen.getByText("Deploy failed")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));

		await rerender(<Bubble text="Yes, ship it" variant="sent" tone="outline" onPress={choose} reactions={[{ key: "ok", emoji: "👍", label: "Thumbs up" }]} />);
		await fireEvent.press(screen.getByRole("button", { name: "Yes, ship it" }));
		expect(choose).toHaveBeenCalledTimes(1);
	});
});
