"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	DataGrid,
	DataGridContainer,
	dataGridFeatures,
	type DataGridFeatures,
	type DataGridTableClassNames,
	type DataGridTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual, type DataGridTableColumnVirtualizerOptions } from "@workspace/ui/components/data-grid/data-grid-table-virtual";
import { useTable, type ColumnDef, type ColumnPinningState, type TableOptions } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

interface IPerson {
	readonly name: string;
	readonly avatar: string;
	readonly initials: string;
}

interface IData {
	readonly id: string;
	readonly person: IPerson;
	readonly metrics: readonly number[];
	readonly total: number;
}

const METRIC_COLUMN_COUNT = 36;
const ROW_COUNT = 1000;
/** Metric columns one previous/next press jumps over. */
const COLUMN_JUMP_SIZE = 8;
/** Metric labels are zero-padded to this many digits ("Metric 01"). */
const METRIC_LABEL_DIGITS = 2;
/** Generated metric values fall in [METRIC_MIN, METRIC_MIN + METRIC_RANGE). */
const METRIC_MIN = 100;
const METRIC_RANGE = 900;
/** Prime strides spread values across rows and columns without randomness, so renders are deterministic. */
const METRIC_ROW_STRIDE = 37;
const METRIC_COLUMN_STRIDE = 19;
/** Row height before measurement, in pixels (dense layout). */
const ROW_ESTIMATE_PX = 41;
/** Rows rendered beyond each edge of the viewport. */
const ROW_OVERSCAN = 8;

function getMetricId(metricIndex: number): string {
	return `metric-${String(metricIndex + 1)}`;
}

function getMetricLabel(metricIndex: number): string {
	return String(metricIndex + 1).padStart(METRIC_LABEL_DIGITS, "0");
}

const METRIC_INDEXES: readonly number[] = Array.from({ length: METRIC_COLUMN_COUNT }, (_value: undefined, metricIndex: number): number => metricIndex);
const COLUMN_IDS: readonly string[] = ["id", "name", ...METRIC_INDEXES.map(getMetricId), "total"];
const COLUMN_VIRTUALIZER_OPTIONS: DataGridTableColumnVirtualizerOptions = { enabled: true, overscan: 3 };
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const PEOPLE: readonly [IPerson, ...IPerson[]] = [
	{
		name: "Alex Johnson",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		initials: "AJ",
	},
	{
		name: "Sarah Chen",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		initials: "SC",
	},
	{
		name: "Michael Rodriguez",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		initials: "MR",
	},
	{
		name: "Emma Wilson",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		initials: "EW",
	},
	{
		name: "David Kim",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		initials: "DK",
	},
	{
		name: "Aron Thompson",
		avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		initials: "AT",
	},
	{
		name: "James Brown",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		initials: "JB",
	},
	{
		name: "Maria Garcia",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		initials: "MG",
	},
	{
		name: "Nick Johnson",
		avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		initials: "NJ",
	},
	{
		name: "Liam Thompson",
		avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		initials: "LT",
	},
];

function cyclePerson(index: number): IPerson {
	const [first] = PEOPLE;
	return PEOPLE.at(index % PEOPLE.length) ?? first;
}

function getMetric(row: IData, metricIndex: number): number {
	return row.metrics.at(metricIndex) ?? 0;
}

// Deterministic pseudo-data: the same grid on every load, no Math.random.
function generateData(count: number): IData[] {
	return Array.from({ length: count }, (_value: undefined, rowIndex: number): IData => {
		const metrics = METRIC_INDEXES.map((metricIndex: number): number => METRIC_MIN + ((rowIndex * METRIC_ROW_STRIDE + metricIndex * METRIC_COLUMN_STRIDE) % METRIC_RANGE));
		return {
			id: String(rowIndex + 1),
			person: cyclePerson(rowIndex),
			metrics,
			total: metrics.reduce((sum: number, value: number): number => sum + value, 0),
		};
	});
}

const ALL_DATA: readonly IData[] = generateData(ROW_COUNT);

function getRowId(row: IData): string {
	return row.id;
}

function createMetricColumn(metricIndex: number): ColumnDef<DataGridFeatures, IData> {
	const metricLabel = `Metric ${getMetricLabel(metricIndex)}`;
	return {
		id: getMetricId(metricIndex),
		accessorFn: (row: IData): number => getMetric(row, metricIndex),
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={metricLabel} column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="block text-right font-mono tabular-nums">{NUMBER_FORMAT.format(getMetric(row.original, metricIndex))}</span>,
		size: 124,
	};
}

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
	{
		accessorKey: "id",
		id: "id",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="#" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground tabular-nums">{row.original.id}</span>,
		size: 72,
		enableSorting: false,
		enableHiding: false,
	},
	{
		id: "name",
		accessorFn: (row: IData): string => row.person.name,
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Team member" column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-2">
				<Avatar className="size-6">
					<AvatarImage src={row.original.person.avatar} alt={row.original.person.name} />
					<AvatarFallback className="text-[10px]">{row.original.person.initials}</AvatarFallback>
				</Avatar>
				<span className="truncate font-medium text-foreground">{row.original.person.name}</span>
			</div>
		),
		size: 190,
		enableHiding: false,
	},
	...METRIC_INDEXES.map(createMetricColumn),
	{
		accessorKey: "total",
		id: "total",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Total" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="block text-right font-medium tabular-nums">{NUMBER_FORMAT.format(row.original.total)}</span>,
		size: 132,
		enableHiding: false,
	},
];

const INITIAL_COLUMN_PINNING: ColumnPinningState = { start: ["id", "name"], end: ["total"] };

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IData>["initialState"]> = { columnPinning: INITIAL_COLUMN_PINNING };

const TABLE_LAYOUT: DataGridTableLayout = { width: "fixed", dense: true, columnsPinnable: true, columnsResizable: true, headerSticky: true };

const TABLE_CLASS_NAMES: DataGridTableClassNames = {
	// z-40, not z-10: pinned BODY cells are sticky at z-30, and a lower thead
	// would let them paint over the header band while rows scroll under it.
	headerSticky: "sticky top-0 z-40 bg-muted/90 backdrop-blur-xs",
};

export function DataGrid32Example(): React.JSX.Element {
	const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(INITIAL_COLUMN_PINNING);
	const [targetMetricIndex, setTargetMetricIndex] = React.useState(0);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: ALL_DATA,
		enableColumnPinning: true,
		getRowId,
		initialState: INITIAL_STATE,
		state: { columnPinning },
		onColumnPinningChange: setColumnPinning,
		// The whole set is already client-side: without this, the registered
		// paginated row model would clip the virtual grid to one page.
		manualPagination: true,
	});

	const handlePrevious = React.useCallback((): void => {
		setTargetMetricIndex((current: number): number => Math.max(0, current - COLUMN_JUMP_SIZE));
	}, []);

	const handleNext = React.useCallback((): void => {
		setTargetMetricIndex((current: number): number => Math.min(METRIC_COLUMN_COUNT - 1, current + COLUMN_JUMP_SIZE));
	}, []);

	// The jump scrolls by CENTER column index, and pinning changes which columns
	// are centered, so the target metric is looked up among the unpinned ones.
	// A pinned metric is already in view: no scroll (-1).
	const centerMetricIndex = COLUMN_IDS.filter((id: string): boolean => !columnPinning.start.includes(id) && !columnPinning.end.includes(id)).indexOf(
		getMetricId(targetMetricIndex),
	);

	return (
		<DataGrid table={table} recordCount={ALL_DATA.length} tableLayout={TABLE_LAYOUT} tableClassNames={TABLE_CLASS_NAMES}>
			{/* No footer here, so the grid itself closes the card: pb-0 removes the
			    empty strip below the container, and overflow-hidden lets the card's
			    radius clip the grid's square bottom corners. */}
			<Card className="w-full gap-3 overflow-hidden py-3.5 pb-0">
				<CardHeader className="items-center px-3.5">
					<CardTitle>Performance Matrix</CardTitle>
					<CardAction className="flex items-center gap-2">
						<span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
							Metric {getMetricLabel(targetMetricIndex)} of {METRIC_COLUMN_COUNT}
						</span>
						<Button
							aria-label="Show previous metric columns"
							title="Show previous metric columns"
							className="size-8"
							disabled={targetMetricIndex === 0}
							size="icon"
							variant="outline"
							onClick={handlePrevious}>
							<ChevronLeftIcon aria-hidden="true" />
						</Button>
						<Button
							aria-label="Show next metric columns"
							title="Show next metric columns"
							className="size-8"
							disabled={targetMetricIndex === METRIC_COLUMN_COUNT - 1}
							size="icon"
							variant="outline"
							onClick={handleNext}>
							<ChevronRightIcon aria-hidden="true" />
						</Button>
					</CardAction>
				</CardHeader>
				<DataGridContainer className="border-t">
					<DataGridScrollArea className="h-[480px]">
						<DataGridTableVirtual
							estimateSize={ROW_ESTIMATE_PX}
							overscan={ROW_OVERSCAN}
							columnVirtualizerOptions={COLUMN_VIRTUALIZER_OPTIONS}
							scrollBehavior="smooth"
							scrollToColumnAlign="center"
							scrollToColumnIndex={centerMetricIndex >= 0 ? centerMetricIndex : undefined}
						/>
					</DataGridScrollArea>
				</DataGridContainer>
			</Card>
		</DataGrid>
	);
}
