import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, CircleDashed } from "lucide-react";
import type * as React from "react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/badge";
import type { DataTableFeatures, Filter } from "@workspace/ui/components/data-table";

// The sample the DataTable examples share: a proposal's document sections,
// schema first with the type derived from it, so every example works on the
// same rows and differs only in the table feature it shows.

const sectionStatusSchema = z.enum(["Done", "In Process"]);
export type SectionStatus = z.output<typeof sectionStatusSchema>;

const documentSectionSchema = z.object({
	id: z.number().int().positive(),
	header: z.string().min(1),
	type: z.string().min(1),
	status: sectionStatusSchema,
	target: z.string(),
	limit: z.string(),
	reviewer: z.string(),
});

export type DocumentSection = z.output<typeof documentSectionSchema>;

export const DOCUMENT_SECTIONS: readonly DocumentSection[] = documentSectionSchema.array().parse([
	{ id: 1, header: "Cover page", type: "Cover page", status: "In Process", target: "18", limit: "5", reviewer: "Eddie Lake" },
	{ id: 2, header: "Table of contents", type: "Technical content", status: "Done", target: "29", limit: "24", reviewer: "Eddie Lake" },
	{ id: 3, header: "Executive summary", type: "Narrative", status: "Done", target: "10", limit: "13", reviewer: "Eddie Lake" },
	{ id: 4, header: "Technical approach", type: "Narrative", status: "Done", target: "27", limit: "23", reviewer: "Jamik Tashpulatov" },
	{ id: 5, header: "Design", type: "Narrative", status: "In Process", target: "2", limit: "16", reviewer: "Jamik Tashpulatov" },
	{ id: 6, header: "Capabilities", type: "Narrative", status: "In Process", target: "20", limit: "8", reviewer: "Jamik Tashpulatov" },
	{ id: 7, header: "Integration with existing systems", type: "Narrative", status: "In Process", target: "19", limit: "21", reviewer: "Jamik Tashpulatov" },
	{ id: 8, header: "Innovation and advantages", type: "Narrative", status: "Done", target: "25", limit: "26", reviewer: "Assign reviewer" },
	{ id: 9, header: "Overview of the solution", type: "Technical content", status: "Done", target: "7", limit: "23", reviewer: "Assign reviewer" },
	{ id: 10, header: "Algorithms and machine learning", type: "Narrative", status: "Done", target: "30", limit: "28", reviewer: "Assign reviewer" },
	{ id: 11, header: "Communication protocols", type: "Narrative", status: "Done", target: "9", limit: "31", reviewer: "Assign reviewer" },
	{ id: 12, header: "Past performance", type: "Narrative", status: "Done", target: "22", limit: "33", reviewer: "Assign reviewer" },
	{ id: 13, header: "Security and data protection", type: "Narrative", status: "In Process", target: "6", limit: "36", reviewer: "Assign reviewer" },
	{ id: 14, header: "Cost-benefit analysis", type: "Plain language", status: "Done", target: "14", limit: "38", reviewer: "Assign reviewer" },
	{ id: 15, header: "System architecture", type: "Technical content", status: "In Process", target: "24", limit: "18", reviewer: "Maya Johnson" },
	{ id: 16, header: "Risk management plan", type: "Narrative", status: "Done", target: "15", limit: "22", reviewer: "Carlos Rodriguez" },
	{ id: 17, header: "Compliance documentation", type: "Legal", status: "In Process", target: "31", limit: "27", reviewer: "Sarah Chen" },
	{ id: 18, header: "API documentation", type: "Technical content", status: "Done", target: "8", limit: "12", reviewer: "Raj Patel" },
	{ id: 19, header: "Interface mockups", type: "Visual", status: "In Process", target: "19", limit: "25", reviewer: "Leila Ahmadi" },
	{ id: 20, header: "Financial projections", type: "Financial", status: "Done", target: "16", limit: "20", reviewer: "Maya Johnson" },
]);

export const STATUS_FILTER: Filter = {
	key: "status",
	label: "Status",
	options: [
		{ value: "Done", label: "Done" },
		{ value: "In Process", label: "In Process" },
	],
};

export const TYPE_FILTER: Filter = {
	key: "type",
	label: "Section type",
	options: ["Narrative", "Technical content", "Legal", "Financial", "Visual", "Plain language", "Cover page"].map((type: string): { value: string; label: string } => ({
		value: type,
		label: type,
	})),
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

/** The columns most examples show. A module constant: a new array on every render would reset the table. */
export const SECTION_COLUMNS: ColumnDef<DataTableFeatures, DocumentSection>[] = [
	{ accessorKey: "header", header: "Section", enableHiding: false, cell: ({ row }): React.JSX.Element => <span className="font-medium">{row.original.header}</span> },
	{ accessorKey: "type", header: "Type" },
	{ accessorKey: "status", header: "Status", cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{row.original.target}</span> },
	{ accessorKey: "limit", header: "Limit", cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{row.original.limit}</span> },
	{ accessorKey: "reviewer", header: "Reviewer" },
];
