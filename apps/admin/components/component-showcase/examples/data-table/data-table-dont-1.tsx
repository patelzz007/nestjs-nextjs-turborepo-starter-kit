"use client";

import type * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const NO_SECTIONS: readonly DocumentSection[] = [];

export function DataTableDont1Example(): React.JSX.Element {
	return <DataTable data={NO_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} />;
}
