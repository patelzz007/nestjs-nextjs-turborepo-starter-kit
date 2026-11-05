// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImportKanbanTasksInput, KanbanImportReport } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { importLabel, ImportKanbanTasksDialog, planKanbanImport } from "@/contexts/kanban/components/import-kanban-tasks-dialog";
import { readKanbanCsv } from "@/contexts/kanban/lib/kanban-csv-import";
import { column, DOING_ID, TODO_ID } from "@/contexts/kanban/lib/__tests__/kanban-fixtures";

interface MutationOptions {
	readonly onSuccess?: (response: { readonly data: KanbanImportReport }) => void;
}

interface ImportCall {
	readonly input: ImportKanbanTasksInput;
	readonly idempotencyKey: string;
}

const { previewMutate, importMutate, previewOptions } = vi.hoisted(() => {
	const holder: { current: MutationOptions | null } = { current: null };
	return { previewMutate: vi.fn<(input: ImportKanbanTasksInput) => void>(), importMutate: vi.fn<(call: ImportCall) => void>(), previewOptions: holder };
});

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ setQueryData: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			kanban: {
				previewImport: {
					useMutation: (options: MutationOptions): object => {
						previewOptions.current = options;
						return { mutate: previewMutate, isPending: false };
					},
				},
				importTasks: { useIdempotentMutation: (): object => ({ mutate: importMutate, isPending: false }) },
			},
		},
	}),
}));

const COLUMNS = [column(TODO_ID, "Ideas", []), column(DOING_ID, "Building", [])];
// Line 2 reads cleanly, line 3 is refused in the browser (no title), lines 4 and 5 read cleanly.
const FILE = "title,column\nFirst,Ideas\n,Ideas\nSecond,Building\nThird,Ideas";

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("planKanbanImport", () => {
	it("skips the browser's refusals and the board's, by file line, and keeps the rest in order", () => {
		const read = readKanbanCsv(FILE, COLUMNS, "EXECUTION");
		const plan = planKanbanImport(read, { rows: 3, importable: 2, problems: [{ row: 1, code: "KANBAN_COLUMN_FULL", message: "Column is full" }] });

		expect(plan.importable.map(({ line }) => line)).toEqual([2, 5]);
		expect(plan.skipped).toEqual([expect.objectContaining({ line: 3 }), { line: 4, message: "Its column would hold too many items." }]);
	});

	it("falls back to the server's own words for a refusal it has no message for", () => {
		const read = readKanbanCsv("title\nOnly", COLUMNS, "EXECUTION");
		expect(planKanbanImport(read, { rows: 1, importable: 0, problems: [{ row: 0, code: "SOMETHING_NEW", message: "A new rule" }] }).skipped).toEqual([
			{ line: 2, message: "A new rule" },
		]);
	});
});

describe("importLabel", () => {
	it("says how many rows import and how many are skipped", () => {
		const read = readKanbanCsv(FILE, COLUMNS, "EXECUTION");
		expect(importLabel(planKanbanImport(read, { rows: 3, importable: 3, problems: [] }))).toBe("Import 3 items, skip 1");
		expect(importLabel(planKanbanImport(readKanbanCsv("title\nOnly", COLUMNS, "EXECUTION"), { rows: 1, importable: 1, problems: [] }))).toBe("Import 1 item");
	});
});

describe("ImportKanbanTasksDialog", () => {
	it("dry-runs the good rows, lists what it will skip, and imports only the rest (enhancement 5.8)", async () => {
		render(<ImportKanbanTasksDialog open board="EXECUTION" columns={COLUMNS} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });
		const file = new File([FILE], "tasks.csv", { type: "text/csv" });
		act((): void => {
			fireEvent.change(screen.getByLabelText("CSV file"), { target: { files: [file] } });
		});

		await waitFor((): void => {
			expect(previewMutate).toHaveBeenCalledTimes(1);
		});
		const [sent] = previewMutate.mock.lastCall ?? [];
		expect(sent?.tasks.map((task) => task.title)).toEqual(["First", "Second", "Third"]);
		expect(screen.getByRole("button", { name: "Import items" })).toHaveProperty("disabled", true);

		act((): void => {
			previewOptions.current?.onSuccess?.({ data: { rows: 3, importable: 2, problems: [{ row: 1, code: "KANBAN_COLUMN_FULL", message: "Column is full" }] } });
		});
		expect(screen.getByText("2 rows will be skipped")).toBeTruthy();
		expect(screen.getByText(/Line 4: Its column would hold too many items/u)).toBeTruthy();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Import 2 items, skip 2" }));
		});
		const [imported] = importMutate.mock.lastCall ?? [];
		expect(imported?.input.tasks.map((task) => task.title)).toEqual(["First", "Third"]);
	});
});
