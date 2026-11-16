import { reorderSections } from "../examples/data-table/data-table-7";
import { answerSectionsQuery } from "../examples/data-table/data-table-13";
import { type DocumentSection, DOCUMENT_SECTIONS } from "../examples/data-table/data-table-sample";

function headersOf(rows: readonly DocumentSection[]): string[] {
	return rows.map((row): string => row.header);
}

const [COVER, , SUMMARY] = DOCUMENT_SECTIONS;

describe("reorderSections", () => {
	it("moves the row shown at `from` to where the row shown at `to` is, by id", () => {
		const rows = DOCUMENT_SECTIONS.slice(0, 3);
		const visible = [SUMMARY, COVER].filter((row): row is DocumentSection => row !== undefined);

		// Shown: summary, cover. Moving the first shown (summary) onto the second (cover) puts it where cover was.
		expect(headersOf(reorderSections(rows, visible, 0, 1))).toEqual(["Executive summary", "Cover page", "Table of contents"]);
	});

	it("keeps the rows when a position is not shown", () => {
		const rows = DOCUMENT_SECTIONS.slice(0, 3);
		expect(reorderSections(rows, [], 0, 1)).toBe(rows);
	});
});

describe("answerSectionsQuery", () => {
	it("filters by status, then cuts out the page", () => {
		const page = answerSectionsQuery({ pageIndex: 1, pageSize: 2, sorting: [], status: "In Process" });
		const inProcess = DOCUMENT_SECTIONS.filter((row): boolean => row.status === "In Process");

		expect(page.totalCount).toBe(inProcess.length);
		expect(headersOf(page.rows)).toEqual(headersOf(inProcess.slice(2, 4)));
	});

	it("sorts by the first sort, numbers as numbers, descending when asked", () => {
		const page = answerSectionsQuery({ pageIndex: 0, pageSize: 3, sorting: [{ id: "target", desc: true }], status: null });

		expect(page.rows.map((row): string => row.target)).toEqual(["31", "30", "29"]);
		expect(page.totalCount).toBe(DOCUMENT_SECTIONS.length);
	});

	it("keeps the order for a column it cannot sort", () => {
		const page = answerSectionsQuery({ pageIndex: 0, pageSize: 2, sorting: [{ id: "unknown", desc: false }], status: null });

		expect(headersOf(page.rows)).toEqual(headersOf(DOCUMENT_SECTIONS.slice(0, 2)));
	});
});
