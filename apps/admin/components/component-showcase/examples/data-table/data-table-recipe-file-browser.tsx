"use client";

import type { Row } from "@tanstack/react-table";
import { File, FileImage, FileText, Folder } from "lucide-react";
import * as React from "react";

import { PLATFORM_DISPLAY_REGION, utcEpochMs } from "@workspace/shared";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import {
	DataTable,
	type DataTableColumns,
	type DataTableEmptyState,
	type DataTableFeatures,
	type DataTableSortingOptions,
	type DataTableToolbar,
} from "@workspace/ui/components/data-table";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";

/** One entry of a folder. A folder holds entries; a file has a size. */
interface FileEntry {
	readonly id: string;
	readonly name: string;
	readonly kind: "folder" | "document" | "image" | "other";
	readonly sizeBytes: number;
	readonly modifiedEpochMs: number;
	readonly children?: readonly FileEntry[];
}

const YEAR = 2026;
const MONTH = 11;

export const FILE_TREE: readonly FileEntry[] = [
	{
		id: "contracts",
		name: "Contracts",
		kind: "folder",
		sizeBytes: 0,
		modifiedEpochMs: utcEpochMs(YEAR, MONTH, 14),
		children: [
			{ id: "contracts-acme", name: "Acme master agreement.pdf", kind: "document", sizeBytes: 482_113, modifiedEpochMs: utcEpochMs(YEAR, MONTH, 14) },
			{ id: "contracts-2025", name: "2025", kind: "folder", sizeBytes: 0, modifiedEpochMs: utcEpochMs(YEAR, 1, 9), children: [] },
		],
	},
	{
		id: "brand",
		name: "Brand",
		kind: "folder",
		sizeBytes: 0,
		modifiedEpochMs: utcEpochMs(YEAR, MONTH, 2),
		children: [
			{ id: "brand-logo", name: "logo.svg", kind: "image", sizeBytes: 8_204, modifiedEpochMs: utcEpochMs(YEAR, MONTH, 2) },
			{ id: "brand-guide", name: "Brand guide.pdf", kind: "document", sizeBytes: 2_310_771, modifiedEpochMs: utcEpochMs(YEAR, 10, 28) },
		],
	},
	{ id: "readme", name: "README.md", kind: "document", sizeBytes: 3_120, modifiedEpochMs: utcEpochMs(YEAR, MONTH, 17) },
	{ id: "photo", name: "Team offsite.jpg", kind: "image", sizeBytes: 4_812_002, modifiedEpochMs: utcEpochMs(YEAR, 9, 30) },
	{ id: "archive", name: "export-backup.zip", kind: "other", sizeBytes: 71_404_118, modifiedEpochMs: utcEpochMs(YEAR, 8, 1) },
];

const BYTES_PER_UNIT = 1024;
const SIZE_UNITS: readonly string[] = ["B", "KB", "MB", "GB"];

/** A byte count as `482 KB` or `68.1 MB`; folders show a dash. */
export function formatFileSize(entry: FileEntry): string {
	if (entry.kind === "folder") {
		return "–";
	}
	let size = entry.sizeBytes;
	let unit = 0;
	while (size >= BYTES_PER_UNIT && unit < SIZE_UNITS.length - 1) {
		size /= BYTES_PER_UNIT;
		unit += 1;
	}
	return `${unit === 0 ? String(size) : size.toFixed(1)} ${SIZE_UNITS.at(unit) ?? ""}`;
}

/** Walks a path of folder ids down from the root, returning the entries of the last folder (the root's when the path is empty). */
export function entriesAt(root: readonly FileEntry[], path: readonly string[]): readonly FileEntry[] {
	return path.reduce<readonly FileEntry[]>((entries, id) => entries.find((entry) => entry.id === id)?.children ?? [], root);
}

/** The folders a path passes through, for the breadcrumb. */
export function foldersOnPath(root: readonly FileEntry[], path: readonly string[]): readonly FileEntry[] {
	const folders: FileEntry[] = [];
	let entries = root;
	for (const id of path) {
		const folder = entries.find((entry) => entry.id === id);
		if (folder === undefined) {
			break;
		}
		folders.push(folder);
		entries = folder.children ?? [];
	}
	return folders;
}

/**
 * Folders first, whichever way the column is sorted. TanStack flips a column's result for a descending sort, so the
 * folder rule is pre-flipped to cancel that out and stay on top.
 */
export function compareFoldersFirst(left: FileEntry, right: FileEntry, descending: boolean): number {
	const leftFolder = left.kind === "folder" ? 0 : 1;
	const rightFolder = right.kind === "folder" ? 0 : 1;
	if (leftFolder !== rightFolder) {
		return descending ? rightFolder - leftFolder : leftFolder - rightFolder;
	}
	return left.name.localeCompare(right.name);
}

function sortNameFoldersFirst(left: Row<DataTableFeatures, FileEntry>, right: Row<DataTableFeatures, FileEntry>): number {
	const sort = left
		.getAllCells()
		.find((cell) => cell.column.id === "name")
		?.column.getIsSorted();
	return compareFoldersFirst(left.original, right.original, sort === "desc");
}

const KIND_ICON: Readonly<Record<FileEntry["kind"], typeof File>> = { folder: Folder, document: FileText, image: FileImage, other: File };

function getEntryId(entry: FileEntry): string {
	return entry.id;
}

const EMPTY_FOLDER: DataTableEmptyState = { title: "This folder is empty", description: "Files you add here will show up in this list." };

/**
 * Recipe: a file browser. Click a folder to open it; the breadcrumb in `toolbar.extra` walks back up. The name column
 * sorts folders first either way round, through its own `sortFn`.
 */
export function DataTableRecipeFileBrowser(): React.JSX.Element {
	const [path, setPath] = React.useState<readonly string[]>([]);

	const handleRowClick = React.useCallback((entry: FileEntry): void => {
		if (entry.kind === "folder") {
			setPath((current) => [...current, entry.id]);
		}
	}, []);

	// One delegated handler for every crumb: it reads how deep to go off the pressed link.
	const handleCrumbClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const depth = Number(event.currentTarget.dataset.depth);
		setPath((current) => current.slice(0, depth));
	}, []);

	const folders = foldersOnPath(FILE_TREE, path);
	const toolbar = React.useMemo(
		(): DataTableToolbar => ({
			extra: (
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							{folders.length === 0 ? (
								<BreadcrumbPage>Files</BreadcrumbPage>
							) : (
								<BreadcrumbLink
									render={
										<Button variant="link" size="sm" className="h-auto p-0" data-depth={0} onClick={handleCrumbClick}>
											Files
										</Button>
									}
								/>
							)}
						</BreadcrumbItem>
						{folders.map((folder, index) => {
							const isLast = index === folders.length - 1;
							return (
								<React.Fragment key={folder.id}>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										{isLast ? (
											<BreadcrumbPage>{folder.name}</BreadcrumbPage>
										) : (
											<BreadcrumbLink
												render={
													<Button variant="link" size="sm" className="h-auto p-0" data-depth={index + 1} onClick={handleCrumbClick}>
														{folder.name}
													</Button>
												}
											/>
										)}
									</BreadcrumbItem>
								</React.Fragment>
							);
						})}
					</BreadcrumbList>
				</Breadcrumb>
			),
		}),
		[folders, handleCrumbClick],
	);

	const columns = React.useMemo(
		(): DataTableColumns<FileEntry> => [
			{
				accessorKey: "name",
				header: "Name",
				size: 300,
				sortFn: sortNameFoldersFirst,
				cell: ({ row }): React.JSX.Element => {
					const Icon = KIND_ICON[row.original.kind];
					return (
						<span className="flex items-center gap-2">
							<Icon className={row.original.kind === "folder" ? "size-4 text-primary" : "size-4 text-muted-foreground"} aria-hidden="true" />
							<span className="truncate">{row.original.name}</span>
						</span>
					);
				},
			},
			{
				accessorKey: "sizeBytes",
				header: "Size",
				size: 110,
				cell: ({ row }): string => formatFileSize(row.original),
				meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" },
			},
			{
				accessorKey: "modifiedEpochMs",
				header: "Modified",
				size: 150,
				cell: ({ row }): string => formatEpochMs(row.original.modifiedEpochMs, "date", PLATFORM_DISPLAY_REGION),
			},
		],
		[],
	);

	return (
		<DataTable
			data={entriesAt(FILE_TREE, path)}
			columns={columns}
			getRowId={getEntryId}
			onRowClick={handleRowClick}
			toolbar={toolbar}
			emptyState={EMPTY_FOLDER}
			sorting={SORTING}
		/>
	);
}

const SORTING: DataTableSortingOptions = { initial: [{ id: "name", desc: false }] };
