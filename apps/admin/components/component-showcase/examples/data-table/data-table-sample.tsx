import type { CellData } from "@tanstack/react-table";
import { CircleCheck, CircleDashed } from "lucide-react";
import type * as React from "react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/badge";
import type { DataTableColumns, DataTableFilter, DataTablePaging } from "@workspace/ui/components/data-table";

// The sample the DataTable examples share: a proposal's document sections, schema first with the type derived from
// it, so every example works on the same rows and differs only in the table feature it shows.

const sectionStatusSchema = z.enum(["Done", "In Process"]);
export type SectionStatus = z.output<typeof sectionStatusSchema>;

const documentSectionSchema = z.object({
	id: z.string().min(1),
	header: z.string().min(1),
	type: z.string().min(1),
	status: sectionStatusSchema,
	/** Pages planned. */
	target: z.number().int().nonnegative(),
	/** Pages allowed. */
	limit: z.number().int().nonnegative(),
	reviewer: z.string(),
});

export type DocumentSection = z.output<typeof documentSectionSchema>;

export const DOCUMENT_SECTIONS: readonly DocumentSection[] = documentSectionSchema.array().parse([
	{ id: "s-1", header: "Cover page", type: "Cover page", status: "In Process", target: 18, limit: 5, reviewer: "Eddie Lake" },
	{ id: "s-2", header: "Table of contents", type: "Technical content", status: "Done", target: 29, limit: 24, reviewer: "Eddie Lake" },
	{ id: "s-3", header: "Executive summary", type: "Narrative", status: "Done", target: 10, limit: 13, reviewer: "Eddie Lake" },
	{ id: "s-4", header: "Technical approach", type: "Narrative", status: "Done", target: 27, limit: 23, reviewer: "Jamik Tashpulatov" },
	{ id: "s-5", header: "Design", type: "Narrative", status: "In Process", target: 2, limit: 16, reviewer: "Jamik Tashpulatov" },
	{ id: "s-6", header: "Capabilities", type: "Narrative", status: "In Process", target: 20, limit: 8, reviewer: "Jamik Tashpulatov" },
	{ id: "s-7", header: "Integration with existing systems", type: "Narrative", status: "In Process", target: 19, limit: 21, reviewer: "Jamik Tashpulatov" },
	{ id: "s-8", header: "Innovation and advantages", type: "Narrative", status: "Done", target: 25, limit: 26, reviewer: "Sarah Chen" },
	{ id: "s-9", header: "Overview of the solution", type: "Technical content", status: "Done", target: 7, limit: 23, reviewer: "Sarah Chen" },
	{ id: "s-10", header: "Algorithms and machine learning", type: "Narrative", status: "Done", target: 30, limit: 28, reviewer: "Raj Patel" },
	{ id: "s-11", header: "Communication protocols", type: "Narrative", status: "Done", target: 9, limit: 31, reviewer: "Raj Patel" },
	{ id: "s-12", header: "Past performance", type: "Narrative", status: "Done", target: 22, limit: 33, reviewer: "Leila Ahmadi" },
	{ id: "s-13", header: "Security and data protection", type: "Narrative", status: "In Process", target: 6, limit: 36, reviewer: "Leila Ahmadi" },
	{ id: "s-14", header: "Cost-benefit analysis", type: "Plain language", status: "Done", target: 14, limit: 38, reviewer: "Carlos Rodriguez" },
	{ id: "s-15", header: "System architecture", type: "Technical content", status: "In Process", target: 24, limit: 18, reviewer: "Maya Johnson" },
	{ id: "s-16", header: "Risk management plan", type: "Narrative", status: "Done", target: 15, limit: 22, reviewer: "Carlos Rodriguez" },
	{ id: "s-17", header: "Compliance documentation", type: "Legal", status: "In Process", target: 31, limit: 27, reviewer: "Sarah Chen" },
	{ id: "s-18", header: "API documentation", type: "Technical content", status: "Done", target: 8, limit: 12, reviewer: "Raj Patel" },
	{ id: "s-19", header: "Interface mockups", type: "Visual", status: "In Process", target: 19, limit: 25, reviewer: "Leila Ahmadi" },
	{ id: "s-20", header: "Financial projections", type: "Financial", status: "Done", target: 16, limit: 20, reviewer: "Maya Johnson" },
]);

/** A row's stable id. Selection, editing, reordering and expansion all address rows by it. */
export function getSectionId(section: DocumentSection): string {
	return section.id;
}

/**
 * The section with one field written, for the editing examples. The value is checked against the schema, so a value
 * the section cannot hold (a page count that is not a whole number) leaves the section as it was.
 */
export function withSectionValue(section: DocumentSection, columnId: string, value: CellData): DocumentSection {
	const written = documentSectionSchema.safeParse({ ...section, [columnId]: value });
	return written.success ? written.data : section;
}

/** Typed or pasted text as a page count, or `undefined` to refuse it. */
export function parsePageCount(raw: string): number | undefined {
	const pages = Number(raw);
	return raw.trim() !== "" && Number.isInteger(pages) && pages >= 0 ? pages : undefined;
}

/** Five rows a page, so every example fits its frame. */
const SECTION_PAGE_SIZE = 5;
export const SECTION_PAGING: DataTablePaging = { pageSize: SECTION_PAGE_SIZE, pageSizeOptions: [SECTION_PAGE_SIZE, 10, 20] };

export const STATUS_FILTER: DataTableFilter = {
	kind: "select",
	column: "status",
	label: "Status",
	options: sectionStatusSchema.options.map((status) => ({ value: status, label: status })),
};

const SECTION_TYPES: readonly string[] = ["Narrative", "Technical content", "Legal", "Financial", "Visual", "Plain language", "Cover page"];

export const TYPE_FILTER: DataTableFilter = {
	kind: "multi-select",
	column: "type",
	label: "Section type",
	options: SECTION_TYPES.map((type) => ({ value: type, label: type })),
};

/** How a section's status looks: the example decides, the table only renders it. */
export function SectionStatusBadge({ status }: { readonly status: SectionStatus }): React.JSX.Element {
	return status === "Done" ? (
		<Badge variant="success-light" className="gap-1">
			<CircleCheck aria-hidden="true" />
			Done
		</Badge>
	) : (
		<Badge variant="warning-light" className="gap-1">
			<CircleDashed aria-hidden="true" />
			In Process
		</Badge>
	);
}

/** Figures line up at the end of their column, under a header that ends there too. */
export const NUMERIC_COLUMN_META = {
	headerClassName: "text-end [&>div]:-me-2 [&>div]:justify-end",
	cellClassName: "text-end tabular-nums",
};

/**
 * The columns most examples show. A module constant: a new array on every render would reset the table. A string
 * `header` becomes the table's own sortable column header.
 */
export const SECTION_COLUMNS: DataTableColumns<DocumentSection> = [
	{
		accessorKey: "header",
		header: "Section",
		size: 260,
		enableHiding: false,
		cell: ({ row }): React.JSX.Element => <span className="font-medium">{row.original.header}</span>,
	},
	{ accessorKey: "type", header: "Type", size: 170 },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", size: 100, meta: NUMERIC_COLUMN_META },
	{ accessorKey: "limit", header: "Limit", size: 100, meta: NUMERIC_COLUMN_META },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180 },
];
