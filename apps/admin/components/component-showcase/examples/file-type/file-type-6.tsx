"use client";

import * as React from "react";

import { PLATFORM_DISPLAY_REGION, utcEpochMs } from "@workspace/shared";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { DataTable, type DataTableColumns, type DataTableFeatures, type DataTableSortingOptions } from "@workspace/ui/components/data-table";
import { FileType, getFileType, getFileTypeCategory, type FileTypeCategory } from "@workspace/ui/components/file-type";
import type { CellContext, Row } from "@tanstack/react-table";

interface FileItem {
	readonly id: string;
	readonly name: string;
	readonly kind: "file" | "folder";
	/** Bytes. Files only: a folder has an item count instead. */
	readonly size?: number;
	readonly items?: number;
	/** ISO date. */
	/** Last modified, in epoch milliseconds. */
	readonly modifiedAtEpochMs: number;
	readonly owner: string;
}

const files: FileItem[] = [
	{
		id: "1",
		name: "Brand assets",
		kind: "folder",
		items: 24,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 2),
		owner: "Ava Patel",
	},
	{
		id: "2",
		name: "Legal",
		kind: "folder",
		items: 6,
		modifiedAtEpochMs: utcEpochMs(2026, 9, 21),
		owner: "Marco Silva",
	},
	{
		id: "3",
		name: "Q3 financial report.pdf",
		kind: "file",
		size: 2516582,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 5),
		owner: "Marco Silva",
	},
	{
		id: "4",
		name: "Customer interviews - synthesis and next steps.docx",
		kind: "file",
		size: 190464,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 6),
		owner: "You",
	},
	{
		id: "5",
		name: "Revenue forecast 2027.xlsx",
		kind: "file",
		size: 933888,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 1),
		owner: "Lena Fischer",
	},
	{
		id: "6",
		name: "Waitlist export.csv",
		kind: "file",
		size: 5033165,
		modifiedAtEpochMs: utcEpochMs(2026, 9, 29),
		owner: "You",
	},
	{
		id: "7",
		name: "Launch keynote.pptx",
		kind: "file",
		size: 19503513,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 4),
		owner: "Ava Patel",
	},
	{
		id: "8",
		name: "Homepage hero.png",
		kind: "file",
		size: 1363149,
		modifiedAtEpochMs: utcEpochMs(2026, 9, 30),
		owner: "Ava Patel",
	},
	{
		id: "9",
		name: "Team offsite.jpg",
		kind: "file",
		size: 3250586,
		modifiedAtEpochMs: utcEpochMs(2026, 9, 12),
		owner: "Lena Fischer",
	},
	{
		id: "10",
		name: "Product walkthrough.mp4",
		kind: "file",
		size: 149631795,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 3),
		owner: "Noah Kim",
	},
	{
		id: "11",
		name: "Podcast episode 12.mp3",
		kind: "file",
		size: 40055603,
		modifiedAtEpochMs: utcEpochMs(2026, 9, 24),
		owner: "Noah Kim",
	},
	{
		id: "12",
		name: "Press kit.zip",
		kind: "file",
		size: 59139686,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 2),
		owner: "Ava Patel",
	},
	{
		id: "13",
		name: "Design system.fig",
		kind: "file",
		size: 24012390,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 6),
		owner: "Ava Patel",
	},
	{
		id: "14",
		name: "app.config.json",
		kind: "file",
		size: 4301,
		modifiedAtEpochMs: utcEpochMs(2026, 10, 6),
		owner: "Noah Kim",
	},
	{
		id: "15",
		name: "Office floor plan.dwg",
		kind: "file",
		size: 7864320,
		modifiedAtEpochMs: utcEpochMs(2026, 8, 27),
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

function compareRowsByName(a: Row<DataTableFeatures, FileItem>, b: Row<DataTableFeatures, FileItem>): number {
	return compareByName(a.original, b.original);
}

type FileCell = CellContext<DataTableFeatures, FileItem>;

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
	return <>{formatEpochMs(row.original.modifiedAtEpochMs, "date", PLATFORM_DISPLAY_REGION)}</>;
}

function fileId(row: FileItem): string {
	return row.id;
}

// A string header becomes the table's own sortable column header.
const COLUMNS: DataTableColumns<FileItem> = [
	{ accessorKey: "name", id: "name", header: "Name", cell: NameCell, sortFn: compareRowsByName, size: 300 },
	{ id: "type", accessorFn: kindOf, header: "Type", size: 130 },
	{
		accessorKey: "size",
		header: "Size",
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
	{ accessorKey: "modifiedAtEpochMs", header: "Modified", cell: ModifiedCell, sortFn: "basic", size: 130 },
	{ accessorKey: "owner", header: "Owner", size: 140 },
];

/** Sorted by name to start with, and a third click returns to the listed order. */
const SORTING: DataTableSortingOptions = { initial: [{ id: "name", desc: false }], cycle: "asc-desc-none" };

export function FileType6Example(): React.JSX.Element {
	// No `paging`: every file shows.
	return <DataTable data={files} columns={COLUMNS} getRowId={fileId} sorting={SORTING} />;
}
