import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import type { DataTableFeatures } from "../../components/data-table";
import {
	assertUniqueDataTableColumnIds,
	DATA_TABLE_UTILITY_COLUMN_IDS,
	findDuplicateDataTableColumnIds,
	isDataTableUtilityColumnId,
	resolveDataTableColumnId,
} from "./column-ids";

interface Row {
	readonly name: string;
	readonly email: string;
}

type Column = ColumnDef<DataTableFeatures, Row>;

const NAME_BY_KEY: Column = { accessorKey: "name", header: "Name" };
const EMAIL_BY_ID: Column = { id: "email", header: "Email" };
const ID_WINS: Column = { id: "contact", accessorKey: "email", header: "Contact" };

describe("resolveDataTableColumnId", () => {
	it("is the explicit id, else the accessorKey, else undefined", () => {
		expect(resolveDataTableColumnId(EMAIL_BY_ID)).toBe("email");
		expect(resolveDataTableColumnId(NAME_BY_KEY)).toBe("name");
		expect(resolveDataTableColumnId(ID_WINS)).toBe("contact");
		expect(resolveDataTableColumnId({ header: "Display only" })).toBeUndefined();
	});
});

describe("utility column ids", () => {
	it("are drag, select and actions", () => {
		expect(DATA_TABLE_UTILITY_COLUMN_IDS).toEqual(["drag", "select", "actions"]);
		expect(isDataTableUtilityColumnId("actions")).toBe(true);
		expect(isDataTableUtilityColumnId("email")).toBe(false);
	});
});

describe("findDuplicateDataTableColumnIds", () => {
	it("finds ids used twice, whether by id or by accessorKey", () => {
		expect(findDuplicateDataTableColumnIds([NAME_BY_KEY, EMAIL_BY_ID, ID_WINS])).toEqual([]);
		expect(findDuplicateDataTableColumnIds([NAME_BY_KEY, { id: "name", header: "Again" }, EMAIL_BY_ID, EMAIL_BY_ID])).toEqual(["name", "email"]);
	});

	it("ignores columns without an id", () => {
		expect(findDuplicateDataTableColumnIds([{ header: "A" }, { header: "B" }])).toEqual([]);
	});
});

describe("assertUniqueDataTableColumnIds", () => {
	it("accepts unique ids", () => {
		expect(() => {
			assertUniqueDataTableColumnIds([NAME_BY_KEY, EMAIL_BY_ID]);
		}).not.toThrow();
	});

	it("names the built-in column a reserved id belongs to", () => {
		expect(() => {
			assertUniqueDataTableColumnIds([
				{ id: "actions", header: "" },
				{ id: "actions", header: "Actions" },
			]);
		}).toThrow('"actions" is reserved for the row-actions menu column (`actions`)');
	});

	it("names an ordinary id used by two caller columns", () => {
		expect(() => {
			assertUniqueDataTableColumnIds([NAME_BY_KEY, { id: "name", header: "Again" }]);
		}).toThrow('"name" is used by more than one column');
	});
});
