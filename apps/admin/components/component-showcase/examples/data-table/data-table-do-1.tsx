"use client";

import { FileText } from "lucide-react";
import type * as React from "react";

import { DataTable, type DataTableEmptyState } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";

import { getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const NO_SECTIONS: readonly DocumentSection[] = [];

function addSection(): void {
	toastMessage.info({ title: "A new section would open here" });
}

const EMPTY_STATE: DataTableEmptyState = {
	icon: <FileText aria-hidden="true" />,
	title: "No sections yet",
	description: "A proposal starts with its cover page.",
	action: { label: "Add section", onClick: addSection },
};

export function DataTableDo1Example(): React.JSX.Element {
	return <DataTable data={NO_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} emptyState={EMPTY_STATE} />;
}
