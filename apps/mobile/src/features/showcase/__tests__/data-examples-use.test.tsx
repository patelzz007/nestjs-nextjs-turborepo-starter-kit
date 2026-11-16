import { act, fireEvent, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as React from "react";

import { fakeDeviceBoundaries, renderShowcaseExample, settle } from "../../../../test/showcase-example";
import { DataGrid22Example } from "../examples/data-grid/data-grid-22";
import { DataTable14Example } from "../examples/data-table/data-table-14";
import { Trace5Example } from "../examples/trace/trace-5";

/** Long enough for Trace5Example to apply every change, one step at a time. */
const APPLY_MS = 10_000;
const APPLY_TICK_MS = 500;

/** The first of `nodes` (the toolbar's control comes before the column's of the same name). */
function firstOf(nodes: readonly TestInstance[]): TestInstance {
	const [node] = nodes;
	if (node === undefined) {
		throw new Error("Nothing matched");
	}
	return node;
}

beforeEach((): void => {
	jest.useFakeTimers();
	fakeDeviceBoundaries();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("the data table's full example, used", () => {
	it("marks the selected rows done, then every matching row, and deletes them", async () => {
		await renderShowcaseExample(<DataTable14Example />);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select Cover page" }));
		await fireEvent.press(screen.getByRole("button", { name: "Mark as done" }));
		await settle();
		expect(screen.getAllByText("Done").length).toBeGreaterThan(0);

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		await fireEvent.press(screen.getByRole("button", { name: /^Select all \d+ rows$/u }));
		await fireEvent.press(screen.getByRole("button", { name: "Mark as done" }));
		await settle();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		await fireEvent.press(screen.getByRole("button", { name: /^Select all \d+ rows$/u }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete selected" }));
		await settle();
		expect(screen.queryByRole("checkbox", { name: "Select Cover page" })).toBeNull();
	});

	it("deletes the selected rows only, edits a cell in place, and reorders a row", async () => {
		await renderShowcaseExample(<DataTable14Example />);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select Design" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select Capabilities" }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete selected" }));
		await settle();
		expect(screen.queryByRole("checkbox", { name: "Select Design" })).toBeNull();
		expect(screen.getByRole("checkbox", { name: "Select Cover page" })).toBeOnTheScreen();

		await fireEvent.press(firstOf(screen.getAllByRole("button", { name: "Eddie Lake" })));
		const field = screen.getByDisplayValue("Eddie Lake");
		await fireEvent.changeText(field, "Mia Wong");
		await fireEvent(field, "blur");
		await settle();
		expect(firstOf(screen.getAllByRole("button", { name: "Mia Wong" }))).toBeOnTheScreen();

		await fireEvent(screen.getByLabelText("Reorder Cover page"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		await fireEvent(screen.getByLabelText("Reorder Cover page"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		await settle();
		expect(screen.getByLabelText("Reorder Cover page")).toBeOnTheScreen();
	});
});

describe("the data grid's members example, used", () => {
	it("filters by status and search, selects rows, and blocks, unblocks, copies and removes a member", async () => {
		await renderShowcaseExample(<DataGrid22Example />);
		const member = String(firstOf(screen.getAllByRole("button", { name: /^Actions for /u })).props.accessibilityLabel).replace("Actions for ", "");

		const choose = async (label: string): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: `Actions for ${member}` }));
			await settle();
			await fireEvent.press(screen.getByRole("menuitem", { name: label }));
			await settle();
		};
		await choose("Block");
		await choose("Unblock");
		await choose("Copy email");
		await choose("Remove");
		expect(screen.getByText(`Removed ${member}`)).toBeOnTheScreen();

		await fireEvent.press(firstOf(screen.getAllByRole("checkbox", { name: "Select row" })));
		expect(screen.getByText("1 selected")).toBeOnTheScreen();

		await fireEvent.press(firstOf(screen.getAllByRole("button", { name: "Status" })));
		await settle();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Active" }));
		await settle();
		await fireEvent.press(firstOf(screen.getAllByRole("button", { name: "Status" })));
		await settle();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Active" }));
		await settle();
		await fireEvent.changeText(screen.getByLabelText("Search members"), "zzz-no-one");
		expect(screen.getByText("No members match.")).toBeOnTheScreen();
	});
});

describe("the trace's plan example, used", () => {
	it("applies every change in turn, plans again, and can be denied", async () => {
		await renderShowcaseExample(<Trace5Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		for (let elapsed = 0; elapsed < APPLY_MS; elapsed += APPLY_TICK_MS) {
			await act((): void => {
				jest.advanceTimersByTime(APPLY_TICK_MS);
			});
		}
		await fireEvent.press(screen.getByRole("button", { name: "Plan again" }));
		await fireEvent.press(screen.getByRole("button", { name: "Deny" }));
		expect(screen.getByRole("button", { name: "Plan again" })).toBeOnTheScreen();
	});
});
