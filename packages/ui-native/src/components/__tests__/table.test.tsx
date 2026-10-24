import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Table, describeTableRow, type TableColumn, type TableRow } from "../table";

type Key = "day" | "claimed" | "redeemed";

const COLUMNS: readonly TableColumn<Key>[] = [
	{ key: "day", label: "Day" },
	{ key: "claimed", label: "Claimed", align: "end" },
	{ key: "redeemed", label: "Redeemed", align: "end" },
];

const ROWS: readonly TableRow<Key>[] = [
	{ key: "1", cells: { day: "Sat, 4 Oct", claimed: "3", redeemed: "2" } },
	{ key: "2", cells: { day: "Sun, 5 Oct", claimed: "1", redeemed: "0" } },
];

/** The header row is hidden from screen readers (each row names its columns): query it anyway. */
const HIDDEN = { includeHiddenElements: true };

describe("Table", () => {
	it("reads each row as one sentence, its first cell naming it", async () => {
		await render(<Table caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} testID="table" />);

		expect(screen.getByTestId("table")).toHaveAccessibleName("Claimed vs redeemed");
		expect(screen.getByLabelText("Sat, 4 Oct: Claimed 3, Redeemed 2")).toBeOnTheScreen();
		expect(screen.getByLabelText("Sun, 5 Oct: Claimed 1, Redeemed 0")).toBeOnTheScreen();
		expect(screen.getByText("Redeemed", HIDDEN)).toBeOnTheScreen();
	});

	it("closes with a footer row", async () => {
		await render(<Table caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} footer={{ key: "total", cells: { day: "Total", claimed: "4", redeemed: "2" } }} />);

		expect(screen.getByLabelText("Total: Claimed 4, Redeemed 2")).toBeOnTheScreen();
	});

	it("names a one-column row by its cell alone", () => {
		const [first] = COLUMNS;
		expect(first).toBeDefined();
		expect(describeTableRow(first === undefined ? [] : [first], { key: "a", cells: { day: "Mon", claimed: "", redeemed: "" } })).toBe("Mon");
		expect(describeTableRow([], { key: "a", cells: { day: "Mon", claimed: "", redeemed: "" } })).toBe("");
	});

	it("bands every other row, unless plain", async () => {
		await render(<Table caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} />);
		expect(screen.getByLabelText("Sat, 4 Oct: Claimed 3, Redeemed 2")).toHaveProp("className", expect.stringContaining("bg-muted/60"));
		expect(screen.getByLabelText("Sun, 5 Oct: Claimed 1, Redeemed 0")).not.toHaveProp("className", expect.stringContaining("bg-muted/60"));

		await render(<Table caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} variant="plain" size="sm" />);
		const plainRow = screen.getByLabelText("Sat, 4 Oct: Claimed 3, Redeemed 2");
		expect(plainRow).not.toHaveProp("className", expect.stringContaining("bg-muted/60"));
		expect(plainRow).toHaveProp("className", expect.stringContaining("min-h-8"));
	});

	it("right-aligns number columns in tabular figures", async () => {
		await render(<Table caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} />);
		expect(screen.getByText("3")).toHaveProp("className", expect.stringContaining("tabular-nums"));
		expect(screen.getByText("Sat, 4 Oct")).toHaveProp("className", expect.stringContaining("flex-1"));
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Table ref={ref} caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} className="gap-2" testID="table" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("table").props.className);
		expect(className).toContain("gap-2");
		expect(className).not.toContain("gap-0.5");
	});
});
