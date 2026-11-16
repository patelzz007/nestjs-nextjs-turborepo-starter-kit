import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Marker, MarkerContent, MarkerIcon } from "../marker";

const LINE = "Read 14 files under src/billing";
const PHASE = "Planning";

function classesOf(testID: string): readonly string[] {
	return String(screen.getByTestId(testID, { includeHiddenElements: true }).props.className).split(" ");
}

describe("Marker", () => {
	it("is one line: a decorative glyph and the text that carries the meaning", async () => {
		await render(
			<Marker>
				<MarkerIcon testID="icon">
					<Text>glyph</Text>
				</MarkerIcon>
				<MarkerContent>{LINE}</MarkerContent>
			</Marker>,
		);
		expect(screen.getByText(LINE)).toBeOnTheScreen();
		expect(screen.queryByTestId("icon")).toBeNull();
	});

	it("draws a rule either side of a separator's text, and rules a border line off from the next", async () => {
		const view = await render(
			<Marker variant="separator" testID="marker">
				<MarkerContent testID="content">{PHASE}</MarkerContent>
			</Marker>,
		);
		expect(screen.getByTestId("marker").children).toHaveLength(3);
		expect(classesOf("content")).toContain("text-center");
		await view.rerender(
			<Marker variant="border" testID="marker">
				<MarkerContent>{LINE}</MarkerContent>
			</Marker>,
		);
		expect(classesOf("marker")).toContain("border-b");
	});

	it("is a named link with onPress, its text underlined, or a button", async () => {
		const onPress = jest.fn();
		const view = await render(
			<Marker onPress={onPress} accessibilityLabel="Review pull request #412">
				<MarkerContent testID="content">{LINE}</MarkerContent>
			</Marker>,
		);
		await fireEvent.press(screen.getByRole("link", { name: "Review pull request #412" }));
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(classesOf("content")).toContain("underline");
		await view.rerender(
			<Marker onPress={onPress} accessibilityLabel="Revert this change" accessibilityRole="button">
				<MarkerContent testID="content">{LINE}</MarkerContent>
			</Marker>,
		);
		expect(screen.getByRole("button", { name: "Revert this change" })).toBeOnTheScreen();
		expect(classesOf("content")).not.toContain("underline");
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Marker ref={ref} className="mt-2" testID="marker" />);
		expect(ref.current).not.toBeNull();
		expect(classesOf("marker").at(-1)).toBe("mt-2");
	});
});
