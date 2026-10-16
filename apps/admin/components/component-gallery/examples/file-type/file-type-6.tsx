"use client";

import * as React from "react";
import { useState } from "react";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { FileType, getFileType, getFileTypeCategory, type FileTypeCategory } from "@workspace/ui/components/file-type";
import { useTable, type CellContext, type ColumnDef, type HeaderContext, type Row, type SortingState } from "@tanstack/react-table";

interface FileItem {
	readonly id: string;
	readonly name: string;
	readonly kind: "file" | "folder";
	/** Bytes. Files only: a folder has an item count instead. */
	readonly size?: number;
	readonly items?: number;
	/** ISO date. */
	readonly modified: string;
	readonly owner: string;
}

const files: FileItem[] = [
	{
		id: "1",
		name: "Brand assets",
		kind: "folder",
		items: 24,
		modified: "2026-10-02",
		owner: "Ava Patel",
	},
	{
		id: "2",
		name: "Legal",
		kind: "folder",
		items: 6,
		modified: "2026-09-21",
		owner: "Marco Silva",
	},
	{
		id: "3",
		name: "Q3 financial report.pdf",
		kind: "file",
		size: 2516582,
		modified: "2026-10-05",
		owner: "Marco Silva",
	},
	{
		id: "4",
		name: "Customer interviews - synthesis and next steps.docx",
		kind: "file",
		size: 190464,
		modified: "2026-10-06",
		owner: "You",
	},
	{
		id: "5",
		name: "Revenue forecast 2027.xlsx",
		kind: "file",
		size: 933888,
		modified: "2026-10-01",
		owner: "Lena Fischer",
	},
	{
		id: "6",
		name: "Waitlist export.csv",
		kind: "file",
		size: 5033165,
		modified: "2026-09-29",
		owner: "You",
	},
	{
		id: "7",
		name: "Launch keynote.pptx",
		kind: "file",
		size: 19503513,
		modified: "2026-10-04",
		owner: "Ava Patel",
	},
	{
		id: "8",
		name: "Homepage hero.png",
		kind: "file",
		size: 1363149,
		modified: "2026-09-30",
		owner: "Ava Patel",
	},
	{
		id: "9",
		name: "Team offsite.jpg",
		kind: "file",
		size: 3250586,
		modified: "2026-09-12",
		owner: "Lena Fischer",
	},
	{
		id: "10",
		name: "Product walkthrough.mp4",
		kind: "file",
		size: 149631795,
		modified: "2026-10-03",
		owner: "Noah Kim",
	},
	{
		id: "11",
		name: "Podcast episode 12.mp3",
		kind: "file",
		size: 40055603,
		modified: "2026-09-24",
		owner: "Noah Kim",
	},
	{
		id: "12",
		name: "Press kit.zip",
		kind: "file",
		size: 59139686,
		modified: "2026-10-02",
		owner: "Ava Patel",
	},
	{
		id: "13",
		name: "Design system.fig",
		kind: "file",
		size: 24012390,
		modified: "2026-10-06",
		owner: "Ava Patel",
	},
	{
		id: "14",
		name: "app.config.json",
		kind: "file",
		size: 4301,
		modified: "2026-10-06",
		owner: "Noah Kim",
	},
	{
		id: "15",
		name: "Office floor plan.dwg",
		kind: "file",
		size: 7864320,
		modified: "2026-08-27",
		owner: "Lena Fischer",
	},
];

const FAMILY_LABELS: Readonly<Record<Exclude<FileTypeCategory, "file">, string>> = {
	archive: "Archive",
	audio: "Audio",
	code: "Code",
	design: "Design",
	document: "Document",
	empty: "File",
	executable: "Application",
	folder: "Folder",
	font: "Font",
	image: "Image",
	presentation: "Presentation",
	spreadsheet: "Spreadsheet",
	video: "Video",
};

// A folder name is not a file name: "v2.1 exports" would resolve to a
// "1 exports" extension, so folders never go through getFileType.
function fileTypeOf(file: FileItem): string {
	return file.kind === "folder" ? "folder" : getFileType(file.name);
}

function kindOf(file: FileItem): string {
	const type = fileTypeOf(file);
	const category = getFileTypeCategory(type);
	// An unknown extension has no family to name, so it names the kind itself.
	return category === "file" ? `${type.toUpperCase()} file` : FAMILY_LABELS[category];
}

const UNITS: readonly string[] = ["B", "KB", "MB", "GB"];
const BYTES_PER_UNIT = 1024;
const sizeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= BYTES_PER_UNIT && unit < UNITS.length - 1) {
		value /= BYTES_PER_UNIT;
		unit += 1;
	}
	return `${sizeNumber.format(value)} ${UNITS.at(unit) ?? ""}`;
}

// A date-only ISO string parses as UTC midnight, so it is formatted in UTC:
// a local zone west of it would show the previous day, and differ from the
// server render.
const dateFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

// A fixed locale keeps the order identical on the server and the client, and
// numeric puts "episode 2" before "episode 12".
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Sort results: the first row before, after, or level with the second. */
const BEFORE = -1;
const AFTER = 1;

// Folders group ahead of files, as in a file manager. A descending sort
// reverses the whole order, so they then move to the end.
function compareByName(a: FileItem, b: FileItem): number {
	if (a.kind !== b.kind) {
		return a.kind === "folder" ? BEFORE : AFTER;
	}
	return collator.compare(a.name, b.name);
}

function compareRowsByName(a: Row<DataGridFeatures, FileItem>, b: Row<DataGridFeatures, FileItem>): number {
	return compareByName(a.original, b.original);
}

type FileCell = CellContext<DataGridFeatures, FileItem>;
type FileHeader = HeaderContext<DataGridFeatures, FileItem>;

function NameHeader({ column }: FileHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Name" column={column} />;
}
function TypeHeader({ column }: FileHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Type" column={column} />;
}
function SizeHeader({ column }: FileHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Size" column={column} />;
}
function ModifiedHeader({ column }: FileHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Modified" column={column} />;
}
function OwnerHeader({ column }: FileHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Owner" column={column} />;
}

function NameCell({ row }: FileCell): React.JSX.Element {
	const file = row.original;
	// The name already reads its extension, so a file's icon is hidden. A
	// folder name says nothing about what the row is, so the folder icon keeps
	// its "Folder" name.
	return (
		<div className="flex min-w-0 items-center gap-2">
			<FileType type={fileTypeOf(file)} size="mini" aria-hidden={file.kind === "folder" ? undefined : true} />
			<span className="truncate font-medium" title={file.name}>
				{file.name}
			</span>
		</div>
	);
}

function SizeCell({ row }: FileCell): React.JSX.Element {
	const { size, items } = row.original;
	return size === undefined ? <span className="text-muted-foreground">{String(items ?? 0)} items</span> : <>{formatBytes(size)}</>;
}

function ModifiedCell({ row }: FileCell): React.JSX.Element {
	return <>{dateFormat.format(new Date(row.original.modified))}</>;
}

function fileId(row: FileItem): string {
	return row.id;
}

const COLUMNS: ColumnDef<DataGridFeatures, FileItem>[] = [
	{ accessorKey: "name", id: "name", header: NameHeader, cell: NameCell, sortFn: compareRowsByName, size: 300 },
	{ id: "type", accessorFn: kindOf, header: TypeHeader, size: 130 },
	{
		accessorKey: "size",
		header: SizeHeader,
		cell: SizeCell,
		// Folders have no byte size, so they sit last in both directions.
		sortFn: "basic",
		sortUndefined: "last",
		size: 100,
		// The header is a padded button in a flex row: justify-end moves it
		// to the end, and -me-2 mirrors the header's own -ms-2, so the sort
		// arrow lines up with the figures below.
		meta: {
			headerClassName: "text-end [&>div]:-me-2 [&>div]:justify-end",
			cellClassName: "text-end tabular-nums",
		},
	},
	// ISO dates sort chronologically as plain text.
	{ accessorKey: "modified", header: ModifiedHeader, cell: ModifiedCell, sortFn: "text", size: 130 },
	{ accessorKey: "owner", header: OwnerHeader, size: 140 },
];

const INITIAL_SORTING: SortingState = [{ id: "name", desc: false }];

export function FileType6Example(): React.JSX.Element {
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);

	const table = useTable({
		features: dataGridFeatures,
		// The shared bundle registers a pagination row model; manualPagination
		// says the data is already the page, so every file renders.
		manualPagination: true,
		columns: COLUMNS,
		data: files,
		getRowId: fileId,
		state: { sorting },
		onSortingChange: setSorting,
	});

	return (
		<DataGrid table={table} recordCount={files.length}>
			<DataGridContainer>
				<DataGridScrollArea>
					<DataGridTable />
				</DataGridScrollArea>
			</DataGridContainer>
		</DataGrid>
	);
}
