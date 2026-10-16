"use client";

import { ArrowLeftRightIcon, CircleAlertIcon, FileSpreadsheetIcon, UsersIcon } from "lucide-react";
import * as React from "react";

import { buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface RejectedRow {
	readonly row: number;
	readonly field: string;
	readonly problem: string;
}

const ERRORS: readonly RejectedRow[] = [
	{ row: 12, field: "email", problem: "Missing" },
	{ row: 87, field: "phone", problem: "Not a phone number" },
	{ row: 233, field: "email", problem: "Invalid domain" },
];

const TOTAL = 2404;

/** Rows the demo import adds on each tick, and how often it ticks. */
const IMPORT_BATCH_SIZE = 143;
const IMPORT_TICK_MS = 120;

const NUMBER_LOCALE = "en-US";
const TOTAL_LABEL = TOTAL.toLocaleString(NUMBER_LOCALE);

const CSV_HEADER = "row,field,problem";
const CSV_LINE_BREAK = "\n";

/** The rejected rows as a CSV, built from the sample data — a local `data:` URL, nothing is fetched. */
const REJECTED_ROWS_CSV_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(
	[CSV_HEADER, ...ERRORS.map((error: RejectedRow): string => `${String(error.row)},${error.field},${error.problem}`)].join(CSV_LINE_BREAK),
)}`;

/** A real download link, styled as a small link button. */
const DOWNLOAD_LINK_CLASS_NAME = buttonVariants({ variant: "link", size: "xs", className: "self-start" });

// The last step counts up in its description, and rejected rows are a Table
// because they are scanned by row number.
export function Trace15Example(): React.JSX.Element {
	const [imported, setImported] = React.useState(0);
	const done = imported >= TOTAL;

	React.useEffect((): (() => void) | undefined => {
		if (done) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setImported((count: number): number => Math.min(count + IMPORT_BATCH_SIZE, TOTAL));
		}, IMPORT_TICK_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [imported, done]);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<FileSpreadsheetIcon />
					</TraceIcon>
					<TraceTitle>Parsed contacts-october.csv</TraceTitle>
					<TraceDescription>2,418 rows</TraceDescription>
				</TraceLine>
				<TraceLine>
					<TraceIcon>
						<ArrowLeftRightIcon />
					</TraceIcon>
					<TraceTitle>Mapped 8 of 9 columns</TraceTitle>
					<TraceDescription>1 ignored</TraceDescription>
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status="error">
							<TraceIcon>
								<CircleAlertIcon />
							</TraceIcon>
							<TraceTitle>Rejected 14 invalid rows</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<div className="flex flex-col gap-2">
							{/* A borderless Card is the outer frame; the table sits flush in it. */}
							<Card className="p-0">
								<CardContent className="p-0">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="h-8 w-14">Row</TableHead>
												<TableHead className="h-8">Field</TableHead>
												<TableHead className="h-8">Problem</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{ERRORS.map((error: RejectedRow): React.JSX.Element => (
												<TableRow key={error.row}>
													<TableCell className="py-1.5">{error.row}</TableCell>
													<TableCell className="py-1.5">
														<code className="text-xs">{error.field}</code>
													</TableCell>
													<TableCell className="py-1.5">{error.problem}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
							<a href={REJECTED_ROWS_CSV_HREF} download="rejected-rows.csv" className={DOWNLOAD_LINK_CLASS_NAME}>
								Download rejected rows as CSV
							</a>
						</div>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceLine status={done ? undefined : "running"}>
					<TraceIcon>
						<UsersIcon />
					</TraceIcon>
					<TraceTitle>
						{done ? "Imported" : "Importing"} {TOTAL_LABEL} contacts
					</TraceTitle>
					{/* Only the end result is announced; every tick would flood a
                screen reader with numbers. */}
					<TraceDescription aria-hidden={!done}>{done ? "in 2.1s" : `${imported.toLocaleString(NUMBER_LOCALE)} of ${TOTAL_LABEL}`}</TraceDescription>
				</TraceLine>
			</Trace>
			<p role="status" className="sr-only">
				{done ? `Imported ${TOTAL_LABEL} contacts` : ""}
			</p>
		</div>
	);
}
