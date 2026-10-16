import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { ChangeRow } from "../change-row";
import { StatTiles } from "@workspace/ui-native/components/stat-tiles";

describe("ChangeRow", () => {
	const ROW = { title: "feat: add contributions", meta: "octocat · 1 hour ago", additions: "120", deletions: "30", changeSummary: "120 lines added, 30 deleted" };

	it("shows the title, the context and the line counts, read as one sentence", async () => {
		await render(<ChangeRow {...ROW} />);

		expect(screen.getByText("feat: add contributions")).toBeOnTheScreen();
		expect(screen.getByText("octocat · 1 hour ago")).toBeOnTheScreen();
		// Drawn for sighted readers; screen readers get them from the row's label instead.
		expect(screen.getByText("+120", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("−30", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByText("+120")).toBeNull();
		expect(screen.getByLabelText("feat: add contributions. octocat · 1 hour ago. 120 lines added, 30 deleted")).toBeOnTheScreen();
	});

	it("draws a leading visual before the title, leaving the row's label as it is", async () => {
		await render(<ChangeRow {...ROW} leading={<Text>avatar</Text>} />);

		expect(screen.getByText("avatar", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByText("avatar")).toBeNull();
		expect(screen.getByLabelText("feat: add contributions. octocat · 1 hour ago. 120 lines added, 30 deleted")).toBeOnTheScreen();
	});

	it("is plain text without an action", async () => {
		await render(<ChangeRow {...ROW} />);

		expect(screen.queryByRole("link")).toBeNull();
	});

	it("is a link with an action", async () => {
		const onPress = jest.fn();
		await render(<ChangeRow {...ROW} onPress={onPress} accessibilityHint="Opens the commit on GitHub" />);

		await fireEvent.press(screen.getByRole("link", { name: /feat: add contributions/ }));

		expect(onPress).toHaveBeenCalledTimes(1);
		expect(screen.getByHintText("Opens the commit on GitHub")).toBeOnTheScreen();
	});
});

describe("StatTiles", () => {
	it("shows each value with its label, read as `label: value`", async () => {
		await render(
			<StatTiles
				items={[
					{ label: "Stars", value: "1,204" },
					{ label: "Forks", value: "7" },
				]}
			/>,
		);

		expect(screen.getByLabelText("Stars: 1,204")).toBeOnTheScreen();
		expect(screen.getByLabelText("Forks: 7")).toBeOnTheScreen();
		expect(screen.getByText("1,204")).toBeOnTheScreen();
	});
});
