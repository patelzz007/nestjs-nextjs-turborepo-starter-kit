import { BULK_MUTATION_MAX_ITEMS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { parseCsv, readKanbanCsv } from "../kanban-csv-import";
import { column, DOING_ID, TODO_ID } from "./kanban-fixtures";

const COLUMNS = [column(TODO_ID, "Ideas", []), column(DOING_ID, "Building", [])];

/** What every imported row defaults to beyond its own cells. */
const NEW_ITEM = { type: "STORY", description: "", labels: [], parentId: null, assigneeId: null, startAt: null, storyPoints: null };

describe("parseCsv", () => {
	it("reads quoted fields with commas, doubled quotes and line breaks, on CRLF or LF", () => {
		expect(parseCsv('title,description\r\n"A, b","say ""hi""\nthen"\nplain,x\n\n')).toEqual([
			["title", "description"],
			["A, b", 'say "hi"\nthen'],
			["plain", "x"],
		]);
	});
});

describe("readKanbanCsv", () => {
	it("reads a row's type, labels, points and dates, defaulting the type to the board's main level", () => {
		const result = readKanbanCsv('title,type,labels,points,start\nEstimated,story,"api, ui",5,2026-06-01', COLUMNS, "EXECUTION");
		expect(result).toMatchObject({ kind: "ready", tasks: [{ type: "STORY", labels: ["api", "ui"], storyPoints: 5, startAt: new Date(2026, 5, 1).getTime() }] });
		expect(readKanbanCsv("title\nPlanned", COLUMNS, "PLANNING")).toMatchObject({ kind: "ready", tasks: [{ type: "FEATURE" }] });
	});

	it("refuses a task (it needs its story) and a level the board does not hold", () => {
		expect(readKanbanCsv("title,type\nStep,task", COLUMNS, "EXECUTION").kind).toBe("invalid");
		expect(readKanbanCsv("title,type\nThing,subtask", COLUMNS, "EXECUTION").kind).toBe("invalid");
	});

	it("maps every row onto the create contract, matching columns by title and defaulting the rest", () => {
		const result = readKanbanCsv("Title,Priority,Team,Column,Due,Progress\nShip,high,qa,building,2026-06-14,40\nPlan,,,,,", COLUMNS, "EXECUTION");

		expect(result).toEqual({
			kind: "ready",
			tasks: [
				{ ...NEW_ITEM, columnId: DOING_ID, title: "Ship", priority: "HIGH", team: "QA", dueAt: new Date(2026, 5, 14).getTime(), progress: 40 },
				{ ...NEW_ITEM, columnId: TODO_ID, title: "Plan", priority: "MEDIUM", team: "PRODUCT", dueAt: null, progress: 0 },
			],
		});
	});

	it("reports every row it refuses, by line, and imports none", () => {
		const result = readKanbanCsv("title,priority,column,due\n,low,,\nOk,urgent,,\nOk,low,Nowhere,\nOk,low,,soon", COLUMNS, "EXECUTION");

		expect(result.kind).toBe("invalid");
		expect(result.kind === "invalid" ? result.problems.map((problem) => problem.line) : []).toEqual([2, 3, 4, 5]);
	});

	it("needs a header with a title column, at least one row, and at most the bulk limit", () => {
		expect(readKanbanCsv("", COLUMNS, "EXECUTION").kind).toBe("invalid");
		expect(readKanbanCsv("name\nx", COLUMNS, "EXECUTION").kind).toBe("invalid");
		expect(readKanbanCsv(`title\n${Array.from({ length: BULK_MUTATION_MAX_ITEMS + 1 }, (_, index) => `Task ${String(index)}`).join("\n")}`, COLUMNS, "EXECUTION").kind).toBe(
			"invalid",
		);
	});
});
