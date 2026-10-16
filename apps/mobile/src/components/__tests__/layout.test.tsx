import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BottomTabBarHeightContext } from "expo-router/tabs";
import * as React from "react";
import { DeviceEventEmitter } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { z } from "zod";

import { Avatar, initialsOf } from "@workspace/ui-native/components/avatar";
import { Card } from "@workspace/ui-native/components/card";
import { DetailList } from "@workspace/ui-native/components/detail-list";
import { ListRow } from "@workspace/ui-native/components/list-row";
import { PrivacyCover } from "../privacy-cover";
import { PageHeaderClearanceProvider } from "../../lib/page-header-clearance";
import { Screen } from "../screen";
import { BodyText, ErrorText, Heading, Label, MutedText, Subheading } from "@workspace/ui-native/components/text";

/** The pull-to-refresh control a scroll view was given (Jest's scroll view does not render it): only the offset is read. */
const RefreshControlElementSchema = z.object({ props: z.object({ progressViewOffset: z.number().optional() }) });

function refreshOffsetOf(testID: string): number | undefined {
	return RefreshControlElementSchema.parse(screen.getByTestId(testID).props.refreshControl).props.progressViewOffset;
}

/** What the OS reports with a keyboard event (Jest runs as iOS, which announces the keyboard before it moves). */
const KEYBOARD_EVENT = { endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 344 }, duration: 250, easing: "keyboard" };

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

	it("adds no tab-bar clearance outside the tabs", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<Screen title="Sign in">
					<BodyText>Content</BodyText>
				</Screen>
			</SafeAreaProvider>,
		);
		expect(screen.queryByTestId("tab-bar-clearance")).toBeNull();
	});

	it("ends its content above the floating tab bar inside the tabs", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<BottomTabBarHeightContext value={106}>
					<Screen title="Home">
						<BodyText>Content</BodyText>
					</Screen>
				</BottomTabBarHeightContext>
			</SafeAreaProvider>,
		);
		expect(screen.getByTestId("tab-bar-clearance")).toHaveStyle({ height: 106 });
	});

	it("drops the room for the tab bar while the keyboard covers it, so nothing empty sits above the keyboard", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<BottomTabBarHeightContext value={106}>
					<Screen title="Home">
						<BodyText>Content</BodyText>
					</Screen>
				</BottomTabBarHeightContext>
			</SafeAreaProvider>,
		);

		await act(() => {
			DeviceEventEmitter.emit("keyboardWillShow", KEYBOARD_EVENT);
		});
		expect(screen.queryByTestId("tab-bar-clearance")).toBeNull();

		await act(() => {
			DeviceEventEmitter.emit("keyboardWillHide", KEYBOARD_EVENT);
		});
		expect(screen.getByTestId("tab-bar-clearance")).toHaveStyle({ height: 106 });
	});

	it("under the app shell's header, leaves the title to the header and starts its content below it", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<PageHeaderClearanceProvider value={123}>
					<Screen title="Home" description="Your account at a glance" testID="screen">
						<BodyText>Content</BodyText>
					</Screen>
				</PageHeaderClearanceProvider>
			</SafeAreaProvider>,
		);

		expect(screen.queryByRole("header")).toBeNull();
		expect(screen.getByText("Your account at a glance")).toBeOnTheScreen();
		expect(screen.getByTestId("screen-content")).toHaveProp("contentContainerStyle", { paddingTop: 123 });
		expect(screen.getByTestId("screen-content")).toHaveProp("scrollIndicatorInsets", { top: 123, bottom: 0 });
	});

	it("without scrolling, fills the screen below the app shell's header with its content", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<PageHeaderClearanceProvider value={123}>
					<Screen scrollable={false} description="A document" testID="screen">
						<BodyText>Pages</BodyText>
					</Screen>
				</PageHeaderClearanceProvider>
			</SafeAreaProvider>,
		);

		const content = screen.getByTestId("screen-content");
		expect(content).toHaveStyle({ paddingTop: 123 });
		expect(content).toHaveProp("className", expect.stringContaining("flex-1"));
		expect(content).not.toHaveProp("contentContainerStyle");
		expect(screen.getByText("Pages")).toBeOnTheScreen();
		expect(screen.queryByRole("header")).toBeNull();
	});

	it("drops the pull-to-refresh spinner below the app shell's header, where the content starts", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<PageHeaderClearanceProvider value={123}>
					<Screen onRefresh={jest.fn()} testID="screen">
						<BodyText>Content</BodyText>
					</Screen>
				</PageHeaderClearanceProvider>
			</SafeAreaProvider>,
		);

		expect(refreshOffsetOf("screen-content")).toBe(123);
	});

	it("leaves the spinner at the top outside the shell", async () => {
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<Screen onRefresh={jest.fn()} testID="screen">
					<BodyText>Content</BodyText>
				</Screen>
			</SafeAreaProvider>,
		);

		expect(refreshOffsetOf("screen-content")).toBeUndefined();
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
