"use client";

import type * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

/** Enough rows that drawing them all would be slow; the table draws only the ones in view. */
const ROW_COUNT = 2000;
/** Each row's height in CSS pixels, so the scroll range is known before rows are drawn. */
const ROW_HEIGHT_PX = 45;
const MAX_HEIGHT_PX = 420;

/** The sample sections repeated into `ROW_COUNT` numbered rows. */
const MANY_SECTIONS: readonly DocumentSection[] = Array.from({ length: ROW_COUNT }, (_, position: number): DocumentSection => {
	const base = DOCUMENT_SECTIONS.at(position % DOCUMENT_SECTIONS.length) ?? DOCUMENT_SECTIONS.at(0);
	if (base === undefined) {
		throw new Error("the sample has at least one section");
	}
	return { ...base, id: position + 1, header: `${base.header} #${String(position + 1)}` };
});

export function DataTable12Example(): React.JSX.Element {
	return (
		<DataTable
			data={MANY_SECTIONS}
			columns={SECTION_COLUMNS}
			searchKeys={["header"]}
			virtualizeRows
			virtualRowHeight={ROW_HEIGHT_PX}
			maxHeight={MAX_HEIGHT_PX}
			pageSize={ROW_COUNT}
			title="Virtualised rows"
			description="Two thousand rows in one scrolling body: only the rows in view are drawn."
		/>
	);
}
