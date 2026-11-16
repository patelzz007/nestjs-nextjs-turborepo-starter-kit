"use client";

import type * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

const PAGE_SIZE = 5;
/** Where the hidden columns, the pinned columns and the page size are remembered for this table. */
const PERSIST_KEY = "showcase-data-table-columns";

export function DataTable8Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			enableColumnVisibility
			enableColumnPinning
			persistKey={PERSIST_KEY}
			pageSize={PAGE_SIZE}
			title="Columns"
			description="Hide columns, pin them to an edge, and find them the same way after a reload."
		/>
	);
}
