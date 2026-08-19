"use client";

// ============================================================
// components/showcase/data-table-showcase.tsx
//
// The **smart** layer for the shared `DataTable` (rules 9/10/11): it owns the
// data shape (zod schema → `z.output`), the column defs, the filters, the row
// actions, the bulk actions, the mobile card renderer and every string. The
// low-level `DataTable` from `@workspace/ui` stays dumb — it receives
// everything via props and knows nothing about the domain.
//
// The columns are typed against the shared component's inferred v9 feature
// type (`DataTableFeatures`), so the compiler only allows APIs the registered
// features actually provide.
// ============================================================

import { toastMessage } from "@workspace/ui/components/feedback/toast";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/feedback/badge";
import { DataTable, type Action, type BulkAction, type DataTableFeatures, type DataTableLabels, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, CircleDashed, Copy, Eye, Pencil, Trash2 } from "lucide-react";

// ── The data shape — schema first, type derived (rule 13) ──────────────────

const dashboardRowSchema = z.object({
	id: z.number(),
	header: z.string(),
	type: z.string(),
	status: z.string(),
	target: z.string(),
	limit: z.string(),
	reviewer: z.string(),
});

type DashboardRow = z.infer<typeof dashboardRowSchema>;

// ── Demo data — content lives at the smart layer (rule 9/10) ───────────────

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "Done", label: "Done" },
	{ value: "In Process", label: "In Process" },
];

const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "Narrative", label: "Narrative" },
	{ value: "Technical content", label: "Technical content" },
	{ value: "Research", label: "Research" },
	{ value: "Legal", label: "Legal" },
	{ value: "Financial", label: "Financial" },
	{ value: "Visual", label: "Visual" },
	{ value: "Plain language", label: "Plain language" },
	{ value: "Cover page", label: "Cover page" },
];

// Human-readable labels for the inline-edit toast (the table reports the raw
// accessor key, not a display label).
const EDITABLE_COLUMN_LABELS: Readonly<Record<string, string>> = {
	header: "Section",
	target: "Target",
	limit: "Limit",
	reviewer: "Reviewer",
};

const DEMO_ROWS: DashboardRow[] = dashboardRowSchema.array().parse([
	{ id: 1, header: "Cover page", type: "Cover page", status: "In Process", target: "18", limit: "5", reviewer: "Eddie Lake" },
	{ id: 2, header: "Table of contents", type: "Technical content", status: "Done", target: "29", limit: "24", reviewer: "Eddie Lake" },
	{ id: 3, header: "Executive summary", type: "Narrative", status: "Done", target: "10", limit: "13", reviewer: "Eddie Lake" },
	{ id: 4, header: "Technical approach", type: "Narrative", status: "Done", target: "27", limit: "23", reviewer: "Jamik Tashpulatov" },
	{ id: 5, header: "Design", type: "Narrative", status: "In Process", target: "2", limit: "16", reviewer: "Jamik Tashpulatov" },
	{ id: 6, header: "Capabilities", type: "Narrative", status: "In Process", target: "20", limit: "8", reviewer: "Jamik Tashpulatov" },
	{ id: 7, header: "Integration with existing systems", type: "Narrative", status: "In Process", target: "19", limit: "21", reviewer: "Jamik Tashpulatov" },
	{ id: 8, header: "Innovation and Advantages", type: "Narrative", status: "Done", target: "25", limit: "26", reviewer: "Assign reviewer" },
	{ id: 9, header: "Overview of EMR's Innovative Solutions", type: "Technical content", status: "Done", target: "7", limit: "23", reviewer: "Assign reviewer" },
	{ id: 10, header: "Advanced Algorithms and Machine Learning", type: "Narrative", status: "Done", target: "30", limit: "28", reviewer: "Assign reviewer" },
	{ id: 11, header: "Adaptive Communication Protocols", type: "Narrative", status: "Done", target: "9", limit: "31", reviewer: "Assign reviewer" },
	{ id: 12, header: "Advantages Over Current Technologies", type: "Narrative", status: "Done", target: "12", limit: "0", reviewer: "Assign reviewer" },
	{ id: 13, header: "Past Performance", type: "Narrative", status: "Done", target: "22", limit: "33", reviewer: "Assign reviewer" },
	{ id: 14, header: "Customer Feedback and Satisfaction Levels", type: "Narrative", status: "Done", target: "15", limit: "34", reviewer: "Assign reviewer" },
	{ id: 15, header: "Implementation Challenges and Solutions", type: "Narrative", status: "Done", target: "3", limit: "35", reviewer: "Assign reviewer" },
	{ id: 16, header: "Security Measures and Data Protection Policies", type: "Narrative", status: "In Process", target: "6", limit: "36", reviewer: "Assign reviewer" },
	{ id: 17, header: "Scalability and Future Proofing", type: "Narrative", status: "Done", target: "4", limit: "37", reviewer: "Assign reviewer" },
	{ id: 18, header: "Cost-Benefit Analysis", type: "Plain language", status: "Done", target: "14", limit: "38", reviewer: "Assign reviewer" },
	{ id: 19, header: "User Training and Onboarding Experience", type: "Narrative", status: "Done", target: "17", limit: "39", reviewer: "Assign reviewer" },
	{ id: 20, header: "Future Development Roadmap", type: "Narrative", status: "Done", target: "11", limit: "40", reviewer: "Assign reviewer" },
	{ id: 21, header: "System Architecture Overview", type: "Technical content", status: "In Process", target: "24", limit: "18", reviewer: "Maya Johnson" },
	{ id: 22, header: "Risk Management Plan", type: "Narrative", status: "Done", target: "15", limit: "22", reviewer: "Carlos Rodriguez" },
	{ id: 23, header: "Compliance Documentation", type: "Legal", status: "In Process", target: "31", limit: "27", reviewer: "Sarah Chen" },
	{ id: 24, header: "API Documentation", type: "Technical content", status: "Done", target: "8", limit: "12", reviewer: "Raj Patel" },
	{ id: 25, header: "User Interface Mockups", type: "Visual", status: "In Process", target: "19", limit: "25", reviewer: "Leila Ahmadi" },
]);

// ── Status badge — the smart layer decides how a value looks ───────────────

function StatusBadge({ status }: { readonly status: string }): React.JSX.Element {
	if (status === "Done") {
		return (
			<Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
				<CircleCheck className="size-3.5" />
				Done
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
			<CircleDashed className="size-3.5" />
			In Process
		</Badge>
	);
}

// ── The showcase — owns all smart data and wires it into the shared table ──

export function DataTableShowcase(): React.JSX.Element {
	// Inline edits and row reorders are DATA mutations — the smart layer owns
	// them (rules 9/10). The demo rows live in state so edits/drags stick.
	const [rows, setRows] = useState<DashboardRow[]>(() => [...DEMO_ROWS]);

	// Row actions (rule 9: the smart layer owns the outcomes).
	const handleView = useCallback((row: DashboardRow): void => {
		toastMessage.info({ title: `Viewing “${row.header}”`, description: `Section type: ${row.type}` });
	}, []);

	const handleEdit = useCallback((row: DashboardRow): void => {
		toastMessage.success({ title: `Editing “${row.header}”` });
	}, []);

	const handleDuplicate = useCallback((row: DashboardRow): void => {
		toastMessage.success({ title: `Duplicated “${row.header}”` });
	}, []);

	const handleDelete = useCallback((row: DashboardRow): void => {
		toastMessage.error({ title: `Deleted “${row.header}”`, description: "This is a demo — no data was removed." });
	}, []);

	// Bulk actions (feature: bulk selection).
	const handleBulkExport = useCallback((rows: DashboardRow[]): void => {
		toastMessage.success({ title: `Exporting ${String(rows.length)} section${rows.length === 1 ? "" : "s"}` });
	}, []);

	const handleBulkMarkDone = useCallback((rows: DashboardRow[]): void => {
		toastMessage.success({ title: `Marked ${String(rows.length)} section${rows.length === 1 ? "" : "s"} as done` });
	}, []);

	// Row click (feature: onRowClick) — same smart-layer contract as the row
	// actions: the table only reports *which* row was clicked, we own the result.
	const handleRowClick = useCallback((row: DashboardRow): void => {
		toastMessage.info({ title: `Opened “${row.header}”`, description: `Click the ⋯ menu for row actions.` });
	}, []);

	// Inline editing (feature: editable). The shared table reports the column id
	// and the full row original — we look the record up by its stable `id` and
	// replace just that field, so edits stay correct under sort/filter/page.
	// The `columnId in item` guard keeps a future `editableColumns` typo from
	// writing a phantom key onto the record.
	const handleCellEdit = useCallback((_rowIndex: number, columnId: string, value: unknown, row: DashboardRow): void => {
		setRows((prev) => prev.map((item) => (item.id === row.id && columnId in item ? { ...item, [columnId]: String(value) } : item)));
		toastMessage.success({ title: `Updated “${row.header}” — ${EDITABLE_COLUMN_LABELS[columnId] ?? columnId} → ${String(value)}` });
	}, []);

	// Row reorder (feature: draggable). The table hands us the visible rows in
	// display order plus the drop target, so we re-anchor by id instead of
	// trusting raw indices (filters/sorting may have re-ordered the row model).
	const handleRowReorder = useCallback((fromIndex: number, toIndex: number, visibleRows: DashboardRow[]): void => {
		const moved = visibleRows[fromIndex];
		if (moved === undefined) {
			return;
		}
		setRows((prev) => {
			const next = [...prev];
			const currentIndex = next.findIndex((item) => item.id === moved.id);
			if (currentIndex === -1) {
				return prev;
			}
			const [removed] = next.splice(currentIndex, 1);
			if (removed === undefined) {
				return prev;
			}
			// Reinsert relative to the visible drop target so the reorder lands
			// where the user dropped it, even with a filtered view.
			const anchor = visibleRows[toIndex];
			const insertAt = anchor === undefined ? next.length : next.findIndex((item) => item.id === anchor.id);
			next.splice(insertAt === -1 ? next.length : insertAt, 0, removed);
			return next;
		});
		toastMessage.success({ title: `Reordered “${moved.header}”` });
	}, []);

	const actions = useMemo<Action<DashboardRow>[]>(
		() => [
			{
				key: "view",
				label: "View",
				description: "Open the section preview",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit section details",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			},
			{
				key: "duplicate",
				label: "Make a copy",
				description: "Duplicate this section",
				icon: <Copy className="size-4" />,
				onClick: handleDuplicate,
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this section permanently",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			},
		],
		[handleView, handleEdit, handleDuplicate, handleDelete],
	);

	const bulkActions = useMemo<BulkAction<DashboardRow>[]>(
		() => [
			{
				key: "export",
				label: "Export selected",
				icon: <Copy className="size-4" />,
				onClick: handleBulkExport,
			},
			{
				key: "mark-done",
				label: "Mark as done",
				icon: <CircleCheck className="size-4" />,
				onClick: handleBulkMarkDone,
			},
		],
		[handleBulkExport, handleBulkMarkDone],
	);

	const filters = useMemo<Filter[]>(
		() => [
			{ key: "status", label: "Status", options: STATUS_OPTIONS },
			{ key: "type", label: "Section type", options: TYPE_OPTIONS },
		],
		[],
	);

	// Columns are typed against the shared component's v9 feature type, so the
	// compiler rejects any API the registered feature set doesn't provide.
	const columns = useMemo<ColumnDef<DataTableFeatures, DashboardRow>[]>(
		() => [
			{
				accessorKey: "header",
				header: "Section",
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => <span className="font-medium">{row.original.header}</span>,
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground">{row.original.type}</span>,
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }): React.JSX.Element => <StatusBadge status={row.original.status} />,
			},
			{
				accessorKey: "target",
				header: "Target",
				cell: ({ row }): React.JSX.Element => <div className="tabular-nums">{row.original.target}</div>,
			},
			{
				accessorKey: "limit",
				header: "Limit",
				cell: ({ row }): React.JSX.Element => <div className="tabular-nums">{row.original.limit}</div>,
			},
			{
				accessorKey: "reviewer",
				header: "Reviewer",
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground">{row.original.reviewer}</span>,
			},
		],
		[],
	);

	// Mobile card view (feature: responsive) — the smart layer renders cards
	// from the same rows when the desktop table is hidden.
	const mobileCardRender = useCallback(
		(item: DashboardRow): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium">{item.header}</p>
						<p className="text-xs text-muted-foreground">{item.reviewer}</p>
					</div>
					<StatusBadge status={item.status} />
				</div>
				<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
					<span>{item.type}</span>
					<span className="tabular-nums">
						Target {item.target} · Limit {item.limit}
					</span>
				</div>
			</div>
		),
		[],
	);

	const dataTableLabels = useMemo(
		(): DataTableLabels => ({
			actionsMenuTitle: "Section actions",
			openRowMenu: "Open section row menu",
		}),
		[],
	);

	return (
		<DataTable
			data={rows}
			columns={columns}
			title="Document sections"
			description="Every smart choice (columns, filters, actions, copy) is owned here — the shared table just renders it."
			searchKeys={["header", "reviewer"]}
			filters={filters}
			actions={actions}
			labels={dataTableLabels}
			bulkActions={bulkActions}
			enableBulkSelection
			enableColumnVisibility
			enableColumnPinning
			exportable
			exportFilename="document-sections.csv"
			exportableColumns={["header", "type", "status", "target", "limit", "reviewer"]}
			persistKey="dashboard-sections"
			pageSize={10}
			pageSizeOptions={[10, 20, 50]}
			searchDebounceMs={200}
			sortCycle="asc-desc-none"
			onRowClick={handleRowClick}
			editable
			editableColumns={["header", "target", "limit", "reviewer"]}
			onCellEdit={handleCellEdit}
			draggable
			onRowReorder={handleRowReorder}
			mobileCardRender={mobileCardRender}
			emptyState={{
				title: "No sections found",
				description: "Try adjusting your search or filter criteria.",
			}}
		/>
	);
}
