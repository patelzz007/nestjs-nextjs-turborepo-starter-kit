import { useTable, type CellContext, type ColumnDef, type Row, type SortingState } from "@tanstack/react-table";
import { getFileType, getFileTypeCategory, type FileTypeCategory } from "@workspace/ui-kit-logic";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import { FileType } from "@workspace/ui-native/components/file-type";
import { dataGridFeatures, type DataGridFeatures } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { formatFileSize } from "./file-type-sample";

interface FileItem {
	readonly id: string;
	readonly name: string;
	readonly kind: "file" | "folder";
	readonly size?: number | undefined;
	readonly items?: number | undefined;
	readonly owner: string;
}

const FILES: readonly FileItem[] = [
	{ id: "3", name: "Q3 financial report.pdf", kind: "file", size: 2_516_582, owner: "Marco Silva" },
	{ id: "1", name: "Brand assets", kind: "folder", items: 24, owner: "Ava Patel" },
	{ id: "5", name: "Revenue forecast 2027.xlsx", kind: "file", size: 933_888, owner: "Lena Fischer" },
	{ id: "7", name: "Launch keynote.pptx", kind: "file", size: 19_503_513, owner: "Ava Patel" },
	{ id: "2", name: "Legal", kind: "folder", items: 6, owner: "Marco Silva" },
	{ id: "8", name: "Homepage hero.png", kind: "file", size: 1_363_149, owner: "Ava Patel" },
	{ id: "10", name: "Product walkthrough.mp4", kind: "file", size: 149_631_795, owner: "Noah Kim" },
	{ id: "12", name: "Press kit.zip", kind: "file", size: 59_139_686, owner: "Ava Patel" },
	{ id: "13", name: "Design system.fig", kind: "file", size: 24_012_390, owner: "Ava Patel" },
	{ id: "15", name: "Office floor plan.dwg", kind: "file", size: 7_864_320, owner: "Lena Fischer" },
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

function typeOf(file: FileItem): string {
	return file.kind === "folder" ? "folder" : getFileType(file.name);
}

/** The Type column: the family's name, or an unknown extension spelled out. */
function kindOf(file: FileItem): string {
	const type = typeOf(file);
	const category = getFileTypeCategory(type);
	return category === "file" ? `${type.toUpperCase()} file` : FAMILY_LABELS[category];
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const BEFORE = -1;
const AFTER = 1;

/** Folders ahead of files, then by name as people read numbers. */
function compareByName(a: FileItem, b: FileItem): number {
	if (a.kind !== b.kind) {
		return a.kind === "folder" ? BEFORE : AFTER;
	}
	return collator.compare(a.name, b.name);
}

function compareRowsByName(a: Row<DataGridFeatures, FileItem>, b: Row<DataGridFeatures, FileItem>): number {
	return compareByName(a.original, b.original);
}

function NameCell({ row }: CellContext<DataGridFeatures, FileItem>): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2.5">
			<FileType type={typeOf(row.original)} size="sm" />
			<Text numberOfLines={1} className="text-label font-sans-medium flex-1 text-foreground">
				{row.original.name}
			</Text>
		</View>
	);
}

function SizeCell({ row }: CellContext<DataGridFeatures, FileItem>): React.JSX.Element {
	const file = row.original;
	return (
		<Text className="text-label font-sans text-muted-foreground tabular-nums">
			{file.kind === "folder" ? `${String(file.items ?? 0)} items` : formatFileSize(file.size ?? 0)}
		</Text>
	);
}

const WIDTH = { name: 240, type: 120, size: 100, owner: 130 } satisfies Record<string, number>;

const COLUMNS: ColumnDef<DataGridFeatures, FileItem>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: NameCell,
		sortFn: compareRowsByName,
		size: WIDTH.name,
		meta: { headerTitle: "Name" },
	},
	{ id: "type", accessorFn: kindOf, header: ({ column }) => <DataGridColumnHeader column={column} />, size: WIDTH.type, meta: { headerTitle: "Type" } },
	// Folders have no byte size, so they sit last in both directions.
	{
		accessorKey: "size",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: SizeCell,
		sortFn: "basic",
		sortUndefined: "last",
		size: WIDTH.size,
		meta: { headerTitle: "Size", align: "end" },
	},
	{ accessorKey: "owner", header: ({ column }) => <DataGridColumnHeader column={column} />, size: WIDTH.owner, meta: { headerTitle: "Owner" } },
];

const INITIAL_SORTING: SortingState = [{ id: "name", desc: false }];

// A file browser: folders sorted ahead of files, a Type column read from each file's family, item counts in place of sizes for folders.
export function FileType6Example(): React.JSX.Element {
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);
	// No pager: every file shows, so the bundle's pagination is told the data is already the page.
	const table = useTable({
		features: dataGridFeatures,
		manualPagination: true,
		columns: COLUMNS,
		data: FILES,
		getRowId: (file: FileItem): string => file.id,
		state: { sorting },
		onSortingChange: setSorting,
	});
	return (
		<DataGrid table={table} recordCount={FILES.length}>
			<DataGridContainer>
				<DataGridTable />
			</DataGridContainer>
		</DataGrid>
	);
}
