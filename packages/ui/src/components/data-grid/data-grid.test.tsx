// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	createDataGridAutoSizeController,
	DataGrid,
	DataGridContainer,
	dataGridFeatures,
	DataGridTableClassNamesSchema,
	DataGridTableLayoutSchema,
	getColumnHeaderLabel,
	getDataGridAutoSizeController,
	getDataGridCellSelectionCellAttrs,
	getDataGridHeaderSpans,
	toDataGridDomId,
	useDataGrid,
	useDataGridAtom,
	type DataGridCellStatus,
	type DataGridContextValue,
	type DataGridRowStatus,
	type DataGridTableLayout,
	type DataGridFeatures,
	type DataGridGridVisitor,
	type DataGridTableInstance,
} from "@workspace/ui/components/data-grid/data-grid";
import { DATA_GRID_TEST_COLUMNS, DATA_GRID_TEST_PEOPLE, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useTable, type ColumnDef, type ColumnSizingState } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

/** Captures the grid context of the nearest `<DataGrid>` into `sink`. */
function ContextProbe({ sink }: { readonly sink: (value: DataGridContextValue) => void }): null {
	sink(useDataGrid());
	return null;
}

function captureContext(element: (sink: (value: DataGridContextValue) => void) => React.ReactNode): DataGridContextValue {
	const captured: DataGridContextValue[] = [];
	function keep(value: DataGridContextValue): void {
		captured.push(value);
	}
	render(<>{element(keep)}</>);
	const latest = captured.at(-1);
	if (latest === undefined) {
		throw new Error("the probe never rendered");
	}
	return latest;
}

const DENSE_LAYOUT: DataGridTableLayout = { dense: true };
/** An equal but distinct object, as an inline `tableLayout={{ … }}` would create. */
const DENSE_LAYOUT_COPY: DataGridTableLayout = { dense: true };
const LIVE_RESIZE_LAYOUT: DataGridTableLayout = { columnsResizable: true, columnsResizeMode: "onChange" };
const EMPTY_LABEL_OVERRIDE: DataGridLabelsOverride = { empty: "Nothing here" };
/** Age above which the CRUD indication marks a row dirty. */
const SENIOR_AGE = 40;

function ignoreContext(): void {
	// The probe only has to render.
}

function statusOfSenior(row: DataGridTestPerson): DataGridRowStatus | undefined {
	return row.age > SENIOR_AGE ? "dirty" : undefined;
}

function statusOfSarahEmail(row: DataGridTestPerson, columnId: string): DataGridCellStatus | undefined {
	return columnId === "email" && row.id === "p-2" ? "invalid" : undefined;
}

const ROW_COUNT_VISITOR: DataGridGridVisitor<number> = {
	visit: (grid) => grid.table.getRowModel().rows.length,
};

const FIRST_NAME_VISITOR: DataGridGridVisitor<string> = {
	visit: (grid) => {
		const [first] = grid.table.getRowModel().rows;
		return first === undefined ? "" : String(first.getValue("name"));
	},
};

describe("dataGridFeatures", () => {
	it("registers every feature the grid parts call into", (): void => {
		expect(Object.keys(dataGridFeatures)).toEqual(
			expect.arrayContaining([
				"columnVisibilityFeature",
				"columnOrderingFeature",
				"columnPinningFeature",
				"columnSizingFeature",
				"columnResizingFeature",
				"columnFilteringFeature",
				"columnFacetingFeature",
				"globalFilteringFeature",
				"rowSortingFeature",
				"rowPaginationFeature",
				"rowSelectionFeature",
				"rowExpandingFeature",
				"rowPinningFeature",
				"cellSelectionFeature",
			]),
		);
	});

	it("ships every built-in sort function so auto sorting never falls back", (): void => {
		expect(Object.keys(dataGridFeatures.sortFns).sort()).toEqual(["alphanumeric", "alphanumericCaseSensitive", "basic", "datetime", "text", "textCaseSensitive"]);
	});
});

describe("layout schemas", () => {
	it("resolves every layout flag to its documented default", (): void => {
		const layout = DataGridTableLayoutSchema.parse({});
		expect(layout).toMatchObject({
			dense: false,
			rowBorder: true,
			headerBorder: true,
			width: "fixed",
			cellSelectionMode: "range",
			cellEditMode: "dblclick",
			cellFillHandleVariant: "dot",
		});
		expect(layout.columnsResizeMode).toBeUndefined();
	});

	it("keeps explicit flags and defaults the sticky-header chrome", (): void => {
		expect(DataGridTableLayoutSchema.parse({ dense: true, width: "auto" })).toMatchObject({ dense: true, width: "auto" });
		expect(DataGridTableClassNamesSchema.parse({}).headerSticky).toContain("sticky");
		expect(DataGridTableClassNamesSchema.parse({ headerSticky: "custom" }).headerSticky).toBe("custom");
	});
});

describe("toDataGridDomId", () => {
	it("replaces every character a DOM id cannot carry", (): void => {
		expect(toDataGridDomId('row 1/"a"')).toBe("row_1__a_");
		expect(toDataGridDomId("plain-id_1")).toBe("plain-id_1");
	});
});

/** Renders a table once and hands it to `inspect`. */
function withTable(
	columns: ColumnDef<DataGridFeatures, DataGridTestPerson>[],
	inspect: (table: DataGridTableInstance<DataGridTestPerson>) => void,
	visibility?: Record<string, boolean>,
): void {
	function Inspector(): null {
		const table = useTable({
			features: dataGridFeatures,
			columns,
			data: [...DATA_GRID_TEST_PEOPLE],
			getRowId: (row: DataGridTestPerson): string => row.id,
			...(visibility === undefined ? {} : { initialState: { columnVisibility: visibility } }),
		});
		inspect(table);
		return null;
	}
	render(<Inspector />);
}

describe("getColumnHeaderLabel", () => {
	it("prefers meta.headerTitle, then a string header, then the column id", (): void => {
		const columns: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [...DATA_GRID_TEST_COLUMNS, { id: "custom", header: (): string => "rendered", cell: (): string => "" }];
		withTable(columns, (table): void => {
			expect(table.getAllLeafColumns().map((column) => getColumnHeaderLabel(column))).toEqual(["Name", "Email address", "Age", "Role", "custom"]);
		});
	});
});

describe("getDataGridHeaderSpans", () => {
	const SPANNING_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
		{ accessorKey: "name", header: "Name", meta: { headerColSpan: 2 } },
		{ accessorKey: "email", header: "Email" },
		{ accessorKey: "age", header: "Age" },
		{ accessorKey: "role", header: "Role" },
	];

	it("maps an owner to the adjacent leaves its header covers", (): void => {
		withTable(SPANNING_COLUMNS, (table): void => {
			const spans = getDataGridHeaderSpans(table);
			expect([...spans.keys()]).toEqual(["name"]);
			expect(spans.get("name")?.map((column) => column.id)).toEqual(["email"]);
		});
	});

	it("drops a hidden sibling from the span instead of covering past it", (): void => {
		withTable(
			SPANNING_COLUMNS,
			(table): void => {
				expect(getDataGridHeaderSpans(table).has("name")).toBe(false);
			},
			{ email: false },
		);
	});

	it("returns no spans when no column asks for one", (): void => {
		withTable(DATA_GRID_TEST_COLUMNS, (table): void => {
			expect(getDataGridHeaderSpans(table).size).toBe(0);
		});
	});
});

describe("getDataGridCellSelectionCellAttrs", () => {
	it("reports selection, focus and edges as presence-only attributes", (): void => {
		withTable(DATA_GRID_TEST_COLUMNS, (table): void => {
			const [row] = table.getRowModel().rows;
			const cell = row?.getVisibleCells().at(LIST_SLOT_INDEX.first);
			if (cell === undefined) {
				throw new Error("no cell");
			}
			const idle = getDataGridCellSelectionCellAttrs(cell);
			expect(idle).toEqual({
				"aria-selected": false,
				"data-col-id": "name",
				"data-cell-selected": undefined,
				"data-cell-focused": undefined,
				"data-cell-edge-top": undefined,
				"data-cell-edge-right": undefined,
				"data-cell-edge-bottom": undefined,
				"data-cell-edge-left": undefined,
			});
		});
	});
});

describe("useDataGrid", () => {
	it("throws outside a <DataGrid>", (): void => {
		const consoleError = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<ContextProbe sink={ignoreContext} />);
		}).toThrow("useDataGrid must be used within <DataGrid>");
		consoleError.mockRestore();
	});

	it("publishes the resolved layout, copy and ids", (): void => {
		const context = captureContext((sink) => (
			<DataGridTestHarness tableLayout={DENSE_LAYOUT} recordCount={42} isLoading>
				<ContextProbe sink={sink} />
			</DataGridTestHarness>
		));
		expect(context.props.tableLayout.dense).toBe(true);
		expect(context.props.tableLayout.rowBorder).toBe(true);
		expect(context.props.loadingMode).toBe("skeleton");
		expect(context.recordCount).toBe(42);
		expect(context.isLoading).toBe(true);
		expect(context.labels.rowCreate).toBe("Add row");
		expect(context.gridId).not.toBe("");
	});

	it("lays the grid's labels override over the provider pack", (): void => {
		const context = captureContext((sink) => (
			<DataGridTestHarness labels={EMPTY_LABEL_OVERRIDE}>
				<ContextProbe sink={sink} />
			</DataGridTestHarness>
		));
		expect(context.labels.empty).toBe("Nothing here");
		expect(context.labels.loading).toBe("Loading…");
		expect(context.labels.goToPage(3)).toBe("Go to page 3");
	});

	it("hands the typed table to a visitor", (): void => {
		const context = captureContext((sink) => (
			<DataGridTestHarness>
				<ContextProbe sink={sink} />
			</DataGridTestHarness>
		));
		expect(context.withGrid(ROW_COUNT_VISITOR)).toBe(DATA_GRID_TEST_PEOPLE.length);
		expect(context.withGrid(FIRST_NAME_VISITOR)).toBe("Alex Johnson");
	});

	it("binds the typed row callbacks by row id", (): void => {
		const onRowClick = vi.fn();
		const context = captureContext((sink) => (
			<DataGridTestHarness onRowClick={onRowClick} getRowStatus={statusOfSenior} getCellStatus={statusOfSarahEmail}>
				<ContextProbe sink={sink} />
			</DataGridTestHarness>
		));
		context.props.onRowClick?.("p-2");
		expect(onRowClick).toHaveBeenCalledWith(DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.second));
		expect(context.props.getRowStatus?.("p-3")).toBe("dirty");
		expect(context.props.getRowStatus?.("p-1")).toBeUndefined();
		expect(context.props.getCellStatus?.("p-2", "email")).toBe("invalid");
		expect(context.props.getCellStatus?.("p-2", "name")).toBeUndefined();
	});

	it("leaves absent callbacks absent, so parts can branch on their presence", (): void => {
		const context = captureContext((sink) => (
			<DataGridTestHarness>
				<ContextProbe sink={sink} />
			</DataGridTestHarness>
		));
		expect(context.props.onRowClick).toBeUndefined();
		expect(context.props.getRowStatus).toBeUndefined();
		expect(context.props.onRowCreate).toBeUndefined();
	});

	it("keeps the context identity across a re-render with an equal inline layout", (): void => {
		const seen: DataGridContextValue[] = [];
		function record(value: DataGridContextValue): void {
			seen.push(value);
		}
		function Host(): React.JSX.Element {
			const [, setTick] = React.useState(0);
			const bump = React.useCallback((): void => {
				setTick((tick) => tick + 1);
			}, []);
			return (
				<>
					<button type="button" onClick={bump}>
						tick
					</button>
					<DataGridTestHarness tableLayout={DENSE_LAYOUT_COPY}>
						<ContextProbe sink={record} />
					</DataGridTestHarness>
				</>
			);
		}
		render(<Host />);
		const [first] = seen;
		fireEvent.click(screen.getByRole("button", { name: "tick" }));
		expect(seen.at(-1)?.props.tableLayout).toBe(first?.props.tableLayout);
	});
});

describe("useDataGridAtom", () => {
	it("re-renders on atom writes and supports a selector", (): void => {
		const renders: number[] = [];
		function Sizes({ table }: { readonly table: DataGridTableInstance<DataGridTestPerson> }): React.JSX.Element {
			const sizing = useDataGridAtom(table.atoms.columnSizing);
			const nameSize = useDataGridAtom(table.atoms.columnSizing, (state: ColumnSizingState): number | undefined => state.name);
			renders.push(nameSize ?? 0);
			return <output>{Object.keys(sizing).join(",")}</output>;
		}
		let captured: DataGridTableInstance<DataGridTestPerson> | undefined;
		render(
			<DataGridTestHarness>
				{(table) => {
					captured = table;
					return <Sizes table={table} />;
				}}
			</DataGridTestHarness>,
		);
		act((): void => {
			captured?.setColumnSizing({ name: 222 });
		});
		expect(screen.getByRole("status").textContent).toBe("name");
		expect(renders.at(-1)).toBe(222);
	});
});

describe("autoSize coordinator", () => {
	const AUTO_SIZE_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
		{ accessorKey: "name", header: "Name", size: 100, meta: { autoSize: true } },
		{ accessorKey: "email", header: "Email", size: 100 },
	];

	function AutoSizeInspector({ onTable }: { readonly onTable: (table: DataGridTableInstance<DataGridTestPerson>) => void }): null {
		onTable(useTable({ features: dataGridFeatures, columns: AUTO_SIZE_COLUMNS, data: [...DATA_GRID_TEST_PEOPLE] }));
		return null;
	}

	function renderAutoSizeTable(): DataGridTableInstance<DataGridTestPerson> {
		const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
		function keep(table: DataGridTableInstance<DataGridTestPerson>): void {
			tables.push(table);
		}
		render(<AutoSizeInspector onTable={keep} />);
		const [table] = tables;
		if (table === undefined) {
			throw new Error("table not created");
		}
		return table;
	}

	it("absorbs the free space into the autoSize column, then reflows it", (): void => {
		const table = renderAutoSizeTable();
		const controller = createDataGridAutoSizeController(table);
		act((): void => {
			expect(controller.apply(50)).toBe(true);
		});
		expect(table.atoms.columnSizing.get().name).toBe(150);
		expect(controller.preview(-20)).toEqual({ columnId: "name", current: 150, size: 130 });
		expect(controller.preview(-500)).toEqual({ columnId: "name", current: 150, size: 100 });
	});

	it("never fills over a width the user dragged", (): void => {
		const table = renderAutoSizeTable();
		const controller = createDataGridAutoSizeController(table);
		act((): void => {
			table.setColumnSizing({ name: 180 });
		});
		expect(controller.apply(50)).toBe(false);
		expect(table.atoms.columnSizing.get().name).toBe(180);
	});

	it("does nothing without free space or an autoSize column", (): void => {
		const table = renderAutoSizeTable();
		expect(createDataGridAutoSizeController(table).apply(0)).toBe(false);
		expect(createDataGridAutoSizeController(table).preview(10)).toBeNull();
	});

	it("adopts a committed width so reflow keeps going", (): void => {
		const table = renderAutoSizeTable();
		const controller = createDataGridAutoSizeController(table);
		act((): void => {
			controller.apply(50);
		});
		controller.adopt("name", 170);
		act((): void => {
			table.setColumnSizing((old) => ({ ...old, name: 170 }));
		});
		expect(controller.preview(0)).toEqual({ columnId: "name", current: 170, size: 170 });
	});

	it("coalesces a streaming resize into a leading and a trailing commit", (): void => {
		vi.useFakeTimers();
		const table = renderAutoSizeTable();
		const controller = createDataGridAutoSizeController(table);
		act((): void => {
			controller.apply(50);
		});
		// The container grows by 20, then by 10 more: each measurement is the free
		// space left over the already-grown column.
		act((): void => {
			expect(controller.apply(20)).toBe(true);
		});
		expect(table.atoms.columnSizing.get().name).toBe(170);
		act((): void => {
			expect(controller.apply(10)).toBe(false);
		});
		expect(table.atoms.columnSizing.get().name).toBe(170);
		act((): void => {
			vi.runAllTimers();
		});
		expect(table.atoms.columnSizing.get().name).toBe(180);
	});

	it("shares one coordinator per table", (): void => {
		const table = renderAutoSizeTable();
		expect(getDataGridAutoSizeController(table)).toBe(getDataGridAutoSizeController(table));
	});
});

describe("DataGrid", () => {
	it("renders its children inside the label provider", (): void => {
		render(
			<DataGridTestHarness>
				<p>grid body</p>
			</DataGridTestHarness>,
		);
		expect(screen.getByText("grid body")).toBeDefined();
	});

	it("re-asserts an explicit resize mode on the table", (): void => {
		const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
		render(
			<DataGridTestHarness tableLayout={LIVE_RESIZE_LAYOUT}>
				{(table) => {
					tables.push(table);
					return null;
				}}
			</DataGridTestHarness>,
		);
		const [firstLeaf] = tables.at(-1)?.getAllLeafColumns() ?? [];
		expect(firstLeaf?.table.options.columnResizeMode).toBe("onChange");
	});

	it("needs a label provider above it", (): void => {
		function Bare(): React.JSX.Element {
			const table = useTable({ features: dataGridFeatures, columns: DATA_GRID_TEST_COLUMNS, data: [...DATA_GRID_TEST_PEOPLE] });
			return <DataGrid table={table} recordCount={0} />;
		}
		const consoleError = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<Bare />);
		}).toThrow(/UiKitLabelsProvider/);
		consoleError.mockRestore();
		render(
			<UiKitTestProviders>
				<Bare />
			</UiKitTestProviders>,
		);
	});
});

describe("DataGridContainer", () => {
	it("renders the grid slot, merges className last and forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<DataGridContainer ref={ref} className="custom-class" variant="bordered">
				content
			</DataGridContainer>,
		);
		const container = screen.getByText("content");
		expect(ref.current).toBe(container);
		expect(container.dataset.slot).toBe("data-grid");
		expect(container.className).toContain("rounded-lg");
		expect(container.className.endsWith("custom-class")).toBe(true);
	});
});
