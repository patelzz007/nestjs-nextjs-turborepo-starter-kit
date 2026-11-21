"use client";

import * as React from "react";
import { z } from "zod";

import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetColumns } from "@workspace/ui/components/spreadsheet";
import { cn } from "@workspace/ui/lib/core/utils";

const shiftSchema = z.enum(["D", "E", "N", "OFF"]);
export type Shift = z.output<typeof shiftSchema>;

const DAYS: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One person's week: a shift code per day. */
interface StaffWeek {
	readonly id: string;
	readonly name: string;
	readonly shifts: readonly Shift[];
}

export const ROSTER: readonly StaffWeek[] = [
	{ id: "s-1", name: "Aisha Rahman", shifts: ["D", "D", "D", "OFF", "OFF", "D", "D"] },
	{ id: "s-2", name: "Ben Ortega", shifts: ["E", "E", "OFF", "E", "E", "OFF", "N"] },
	{ id: "s-3", name: "Chen Wei", shifts: ["N", "N", "N", "OFF", "OFF", "E", "E"] },
	{ id: "s-4", name: "Divya Nair", shifts: ["OFF", "D", "D", "D", "D", "OFF", "OFF"] },
];

const SHIFT_STYLE: Readonly<Record<Shift, { readonly label: string; readonly className: string }>> = {
	D: { label: "Day", className: "bg-info-soft text-info-foreground" },
	E: { label: "Evening", className: "bg-warning-soft text-warning-foreground" },
	N: { label: "Night", className: "bg-primary/12 text-primary" },
	OFF: { label: "Off", className: "text-muted-foreground" },
};

/** Typed text as a shift code (`d`, `e`, `n` or `off`, any case), or `undefined` to refuse it. */
export function parseShift(raw: string): Shift | undefined {
	const shift = shiftSchema.safeParse(raw.trim().toUpperCase());
	return shift.success ? shift.data : undefined;
}

/** How many people work each kind of shift on one day, for the coverage line. */
export function coverageOn(roster: readonly StaffWeek[], day: number): Readonly<Record<Shift, number>> {
	const counts: Record<Shift, number> = { D: 0, E: 0, N: 0, OFF: 0 };
	for (const week of roster) {
		const shift = week.shifts.at(day);
		if (shift !== undefined) {
			counts[shift] += 1;
		}
	}
	return counts;
}

/** Applies a grid write: each change sets one day of one person, refusing anything that is not a shift code. */
export function applyRosterChanges(roster: readonly StaffWeek[], change: SpreadsheetCellsChange<StaffWeek>): StaffWeek[] {
	return roster.map((week): StaffWeek => {
		const mine = change.changes.filter((cell) => cell.rowId === week.id);
		if (mine.length === 0) {
			return week;
		}
		const shifts = week.shifts.map((shift, day): Shift => {
			const written = mine.find((cell) => cell.columnId === DAYS.at(day));
			const parsed = shiftSchema.safeParse(written?.value);
			return parsed.success ? parsed.data : shift;
		});
		return { ...week, shifts };
	});
}

function ShiftCell({ shift }: { readonly shift: Shift | undefined }): React.JSX.Element {
	if (shift === undefined) {
		return <span className="text-muted-foreground">–</span>;
	}
	const style = SHIFT_STYLE[shift];
	return (
		<span className={cn("inline-flex min-w-10 justify-center rounded px-1.5 text-xs font-medium", style.className)} title={style.label}>
			{shift}
		</span>
	);
}

const COLUMNS: SpreadsheetColumns<StaffWeek> = [
	{ accessorKey: "name", header: "Person", size: 160 },
	...DAYS.map((day, index): SpreadsheetColumns<StaffWeek>[number] => ({
		id: day,
		header: day,
		size: 72,
		accessorFn: (week: StaffWeek): string => week.shifts.at(index) ?? "",
		cell: ({ row }): React.JSX.Element => <ShiftCell shift={row.original.shifts.at(index)} />,
		meta: { cellClassName: "text-center", headerClassName: "text-center", cellEdit: { parse: parseShift } },
	})),
];

function getStaffId(week: StaffWeek): string {
	return week.id;
}

/**
 * Recipe: a schedule matrix, on `Spreadsheet` in single-cell mode. Click a day and type D, E, N or OFF; anything
 * else is refused. Copy a day and paste it over others to repeat a pattern. The line under the grid counts who is on
 * each shift per day, recalculated from the rows.
 */
export function DataTableRecipeScheduleMatrix(): React.JSX.Element {
	const [roster, setRoster] = React.useState<readonly StaffWeek[]>(ROSTER);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<StaffWeek>): void => {
		setRoster((current) => applyRosterChanges(current, change));
	}, []);

	return (
		<div className="grid gap-3">
			<Spreadsheet data={roster} columns={COLUMNS} getRowId={getStaffId} selectionMode="single" onCellsChange={handleCellsChange} />
			<dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{DAYS.map((day, index) => {
					const coverage = coverageOn(roster, index);
					return (
						<div key={day} className="flex gap-1">
							<dt className="font-medium text-foreground">{day}</dt>
							<dd className="tabular-nums">
								{coverage.D}D · {coverage.E}E · {coverage.N}N
							</dd>
						</div>
					);
				})}
			</dl>
		</div>
	);
}
