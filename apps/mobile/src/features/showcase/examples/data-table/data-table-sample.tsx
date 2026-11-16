// The sample the DataTable examples share: a proposal's document sections, schema first with the type derived
// from it, so every example works on the same rows and differs only in the table feature it shows.

import type { DataTableClientPagination } from "@workspace/ui-kit-logic";
import { Badge } from "@workspace/ui-native/components/badge";
import type { DataTableColumn, DataTableFilter } from "@workspace/ui-native/components/data-table";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import * as React from "react";
import { z } from "zod";

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

export const STATUS_FILTER: DataTableFilter = {
	key: "status",
	label: "Status",
	options: [
		{ value: "Done", label: "Done" },
		{ value: "In Process", label: "In Process" },
	],
};

export const TYPE_FILTER: DataTableFilter = {
	key: "type",
	label: "Section type",
	options: ["Narrative", "Technical content", "Legal", "Financial", "Visual", "Plain language", "Cover page"].map(
		(type: string): { readonly value: string; readonly label: string } => ({
			value: type,
			label: type,
		}),
	),
};

/** How a section's status looks: the example decides, the table only renders it. */
export function SectionStatusBadge({ status }: { readonly status: SectionStatus }): React.JSX.Element {
	return status === "Done" ? (
		<Badge label="Done" tone="success" variant="light" size="sm" icon={CircleCheckIcon} />
	) : (
		<Badge label="In Process" tone="warning" variant="light" size="sm" icon={CircleDashedIcon} />
	);
}

/** A section's stable id, which the table tracks rows by. */
export function sectionId(section: DocumentSection): string {
	return String(section.id);
}

/** Client-side paging that tracks rows by their id, so selection and edits follow a row through a sort. */
export const SECTION_PAGINATION: DataTableClientPagination<DocumentSection> = { mode: "client", getRowId: sectionId };

/** The columns most examples show. A module constant: a new array on every render would reset the table. */
export const SECTION_COLUMNS: readonly DataTableColumn<DocumentSection>[] = [
	{ id: "header", header: "Section", width: "lg", enableHiding: false, value: (row: DocumentSection): string => row.header },
	{ id: "type", header: "Type", value: (row: DocumentSection): string => row.type },
	{
		id: "status",
		header: "Status",
		value: (row: DocumentSection): string => row.status,
		cell: (row: DocumentSection): React.JSX.Element => <SectionStatusBadge status={row.status} />,
	},
	{ id: "target", header: "Target", width: "sm", align: "end", value: (row: DocumentSection): string => row.target },
	{ id: "limit", header: "Limit", width: "sm", align: "end", value: (row: DocumentSection): string => row.limit },
	{ id: "reviewer", header: "Reviewer", value: (row: DocumentSection): string => row.reviewer },
];
