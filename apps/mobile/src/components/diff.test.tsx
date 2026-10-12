import { fireEvent, render, screen } from "@testing-library/react-native";
import FileDiffIcon from "lucide-react-native/icons/file-diff";
import * as React from "react";
import { Text } from "react-native";

import { Avatar } from "./avatar";
import { ChangedFile } from "./changed-file";
import { DiffStat } from "./diff-stat";
import { DiffView, type DiffLine } from "./diff-view";

const LINES: readonly DiffLine[] = [
	{ key: "hunk:1:1", kind: "hunk", oldNumber: null, newNumber: null, text: "@@ -1,2 +1,2 @@ export function app() {" },
	{ key: "=:1:1", kind: "context", oldNumber: 1, newNumber: 1, text: "import { a } from './a';" },
	{ key: "-:2", kind: "deletion", oldNumber: 2, newNumber: null, text: "const b = 1;" },
	{ key: "+:2", kind: "addition", oldNumber: null, newNumber: 2, text: "\tconst b = 2;" },
	{ key: "note:+:2", kind: "note", oldNumber: null, newNumber: null, text: "No newline at end of file" },
];

describe("DiffView", () => {
	it("draws each line with its numbers and marker, and reads it out by what happened to it", async () => {
		await render(<DiffView lines={LINES} />);

		expect(screen.getByLabelText("Changes from @@ -1,2 +1,2 @@ export function app() {")).toBeOnTheScreen();
		expect(screen.getByLabelText("Line 1: import { a } from './a';")).toBeOnTheScreen();
		expect(screen.getByLabelText("Deleted line 2: const b = 1;")).toBeOnTheScreen();
		expect(screen.getByLabelText("Added line 2: \tconst b = 2;")).toBeOnTheScreen();
		expect(screen.getByLabelText("No newline at end of file")).toBeOnTheScreen();
		// Drawn for sighted readers: the markers and the code, a tab as spaces.
		expect(screen.getByText("−", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("+", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("    const b = 2;", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("leaves the gutter empty on the side a line does not exist", async () => {
		await render(<DiffView lines={LINES} />);

		// "2" appears once as the deleted line's old number and once as the added line's new number.
		expect(screen.getAllByText("2", { includeHiddenElements: true })).toHaveLength(2);
		expect(screen.getAllByText("1", { includeHiddenElements: true })).toHaveLength(2);
	});
});

describe("DiffStat", () => {
	it("draws five squares split between added, deleted and unchanged", async () => {
		await render(<DiffStat blocks={{ added: 2, deleted: 1, unchanged: 2 }} testID="stat" />);

		expect(screen.getAllByTestId("stat-added", { includeHiddenElements: true })).toHaveLength(2);
		expect(screen.getAllByTestId("stat-deleted", { includeHiddenElements: true })).toHaveLength(1);
		expect(screen.getAllByTestId("stat-unchanged", { includeHiddenElements: true })).toHaveLength(2);
	});

	it("is hidden from screen readers — the counts beside it carry the meaning", async () => {
		await render(<DiffStat blocks={{ added: 5, deleted: 0, unchanged: 0 }} testID="stat" />);

		expect(screen.queryByTestId("stat")).toBeNull();
	});
});

describe("ChangedFile", () => {
	const FILE = {
		path: "src/new-name.ts",
		statusLabel: "Renamed",
		statusIcon: FileDiffIcon,
		statusColorClassName: "accent-info-foreground",
		additions: "12",
		deletions: "3",
		changeSummary: "12 lines added, 3 deleted",
		blocks: { added: 4, deleted: 1, unchanged: 0 },
	};

	it("is a button naming the file, what happened to it and its line counts, with its expanded state", async () => {
		await render(
			<ChangedFile {...FILE} previousPath="src/old-name.ts" expanded={false} onToggle={jest.fn()}>
				<Text>the diff</Text>
			</ChangedFile>,
		);

		const header = screen.getByRole("button", { name: "src/new-name.ts, from src/old-name.ts. Renamed. 12 lines added, 3 deleted" });
		expect(header).toBeCollapsed();
		expect(screen.getByText("from src/old-name.ts", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("+12", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByHintText("Shows the changes")).toBeOnTheScreen();
		expect(screen.queryByText("the diff")).toBeNull();
	});

	it("shows its body while expanded, and asks to toggle when pressed", async () => {
		const onToggle = jest.fn();
		await render(
			<ChangedFile {...FILE} previousPath={null} expanded onToggle={onToggle}>
				<Text>the diff</Text>
			</ChangedFile>,
		);

		expect(screen.getByText("the diff")).toBeOnTheScreen();
		expect(screen.getByHintText("Hides the changes")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "src/new-name.ts. Renamed. 12 lines added, 3 deleted" }));
		expect(onToggle).toHaveBeenCalledTimes(1);
	});
});

describe("Avatar sizes", () => {
	it("draws a small avatar's initials too", async () => {
		await render(<Avatar name="Octo Cat" imageUrl={null} size="sm" />);

		expect(screen.getByLabelText("Octo Cat's initials")).toHaveTextContent("OC");
	});
});
