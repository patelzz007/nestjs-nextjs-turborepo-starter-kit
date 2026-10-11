import { render, screen } from "@testing-library/react-native";
import * as React from "react";

import { DataTable, describeRow, type DataTableColumn, type DataTableRow } from "./data-table";

type Key = "day" | "claimed" | "redeemed";

const COLUMNS: readonly DataTableColumn<Key>[] = [
	{ key: "day", label: "Day" },
	{ key: "claimed", label: "Claimed", align: "end" },
	{ key: "redeemed", label: "Redeemed", align: "end" },
];

const ROWS: readonly DataTableRow<Key>[] = [
	{ key: "1", cells: { day: "Sat, 4 Oct", claimed: "3", redeemed: "2" } },
	{ key: "2", cells: { day: "Sun, 5 Oct", claimed: "1", redeemed: "0" } },
];

/** The header row is hidden from screen readers (each row names its columns): query it anyway. */
const HIDDEN = { includeHiddenElements: true };

describe("DataTable", () => {
	it("reads each row as one sentence, its first cell naming it", async () => {
		await render(<DataTable caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} testID="table" />);

		expect(screen.getByTestId("table")).toHaveAccessibleName("Claimed vs redeemed");
		expect(screen.getByLabelText("Sat, 4 Oct: Claimed 3, Redeemed 2")).toBeOnTheScreen();
		expect(screen.getByLabelText("Sun, 5 Oct: Claimed 1, Redeemed 0")).toBeOnTheScreen();
		expect(screen.getByText("Redeemed", HIDDEN)).toBeOnTheScreen();
	});

	it("closes with a footer row", async () => {
		await render(<DataTable caption="Claimed vs redeemed" columns={COLUMNS} rows={ROWS} footer={{ key: "total", cells: { day: "Total", claimed: "4", redeemed: "2" } }} />);

		expect(screen.getByLabelText("Total: Claimed 4, Redeemed 2")).toBeOnTheScreen();
	});

	it("names a one-column row by its cell alone", () => {
		const [first] = COLUMNS;
		expect(first).toBeDefined();
		expect(describeRow(first === undefined ? [] : [first], { key: "a", cells: { day: "Mon", claimed: "", redeemed: "" } })).toBe("Mon");
		expect(describeRow([], { key: "a", cells: { day: "Mon", claimed: "", redeemed: "" } })).toBe("");
	});
});
