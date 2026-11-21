"use client";

import * as React from "react";

import { DataTable, type DataTableHeading, type DataTableInfiniteSource, type DataTableLayout } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS } from "./data-table-sample";

/** How many more rows each step reveals. */
const BATCH_SIZE = 6;

const MAX_BODY_HEIGHT = 300;
const LAYOUT: DataTableLayout = { maxHeight: MAX_BODY_HEIGHT, stickyHeader: true };

/**
 * Every row is already in memory; the table shows a batch and asks for the next one as the reader nears the end.
 * `hasMore` turns false once everything is shown, and the table stops asking.
 */
export function DataTable19Example(): React.JSX.Element {
	const [shownCount, setShownCount] = React.useState(BATCH_SIZE);
	const sections = React.useMemo(() => DOCUMENT_SECTIONS.slice(0, shownCount), [shownCount]);

	const source = React.useMemo(
		(): DataTableInfiniteSource => ({
			mode: "infinite",
			hasMore: shownCount < DOCUMENT_SECTIONS.length,
			isFetchingMore: false,
			onLoadMore: (): void => {
				setShownCount((current) => Math.min(current + BATCH_SIZE, DOCUMENT_SECTIONS.length));
			},
		}),
		[shownCount],
	);

	const heading = React.useMemo(
		(): DataTableHeading => ({ title: "Proposal sections", description: `Showing ${String(sections.length)} of ${String(DOCUMENT_SECTIONS.length)}` }),
		[sections.length],
	);

	return <DataTable data={sections} columns={SECTION_COLUMNS} getRowId={getSectionId} source={source} heading={heading} layout={LAYOUT} />;
}
