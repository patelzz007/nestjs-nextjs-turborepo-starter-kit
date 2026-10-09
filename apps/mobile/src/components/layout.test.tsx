import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { Avatar, initialsOf } from "./avatar";
import { Card } from "./card";
import { DetailList } from "./detail-list";
import { ListRow } from "./list-row";
import { PrivacyCover } from "./privacy-cover";
import { Screen } from "./screen";
import { BodyText, ErrorText, Heading, Label, MutedText, Subheading } from "./text";

/** A phone-sized frame: SafeAreaProvider renders nothing until it knows the metrics. */
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe("Screen", () => {
	it("shows its title as a header, a description and its content", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<Screen title="Settings" description="Your preferences">
					<BodyText>Content</BodyText>
				</Screen>
			</SafeAreaProvider>,
		);
		expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();
		expect(screen.getByText("Your preferences")).toBeOnTheScreen();
		expect(screen.getByText("Content")).toBeOnTheScreen();
	});

	it("renders without a title", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<Screen onRefresh={jest.fn()} refreshing>
					<BodyText>Only content</BodyText>
				</Screen>
			</SafeAreaProvider>,
		);
		expect(screen.queryByRole("header")).toBeNull();
	});
});

describe("Card and text", () => {
	it("renders the card's title, description and children with the type roles", async () => {
		await render(
			<Card title="About" description="This build">
				<Heading>H</Heading>
				<Subheading>S</Subheading>
				<MutedText>M</MutedText>
				<Label>L</Label>
				<ErrorText>E</ErrorText>
			</Card>,
		);
		expect(screen.getByRole("header", { name: "About" })).toBeOnTheScreen();
		expect(screen.getByText("This build")).toBeOnTheScreen();
		expect(screen.getAllByRole("header")).toHaveLength(3);
		expect(screen.getByText("E")).toBeOnTheScreen();
	});

	it("renders a card without a title", async () => {
		await render(<Card testID="plain">{null}</Card>);
		expect(screen.getByTestId("plain")).toBeOnTheScreen();
	});
});

describe("ListRow", () => {
	it("is a button named by its label and value", async () => {
		const onPress = jest.fn();
		await render(<ListRow label="Appearance" value="Dark" description="Theme" onPress={onPress} />);
		await fireEvent.press(screen.getByRole("button", { name: "Appearance, Dark" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("is named by its label alone without a value", async () => {
		await render(<ListRow label="Security" onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Security" })).toBeOnTheScreen();
	});
});

describe("DetailList", () => {
	it("renders every pair as text with an accessible label", async () => {
		await render(
			<DetailList
				items={[
					{ label: "Signed in", value: "3 Oct 2026" },
					{ label: "IP", value: "<script>" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Signed in: 3 Oct 2026")).toBeOnTheScreen();
		expect(screen.getByText("<script>")).toBeOnTheScreen();
	});
});

describe("Avatar", () => {
	it("shows initials without a picture", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl={null} />);
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
	});

	it("shows the picture when there is one", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl="https://cdn.example.com/a.png" />);
		expect(screen.getByLabelText("Alex Morgan's profile picture")).toBeOnTheScreen();
	});

	it.each([
		["Alex Morgan", "AM"],
		["alex", "A"],
		["  Ana  Maria  Lopez ", "AM"],
		["", ""],
	])("initials of %j are %j", (name, initials) => {
		expect(initialsOf(name)).toBe(initials);
	});
});

describe("PrivacyCover", () => {
	it("covers the app only while visible, hidden from screen readers", async () => {
		const { rerender } = await render(<PrivacyCover visible appName="Starter" />);
		expect(screen.getByTestId("privacy-cover", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByTestId("privacy-cover")).toBeNull();
		await rerender(<PrivacyCover visible={false} appName="Starter" />);
		expect(screen.queryByTestId("privacy-cover", { includeHiddenElements: true })).toBeNull();
	});
});
