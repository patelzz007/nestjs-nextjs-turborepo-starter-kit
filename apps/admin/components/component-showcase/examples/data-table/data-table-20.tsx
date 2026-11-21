"use client";

import * as React from "react";

import { DataTable, type DataTableHeading, type DataTableInfiniteSource, type DataTableLayout } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

/** Rows per request, and how long the pretend server takes to answer one. */
const BATCH_SIZE = 6;
const LATENCY_MS = 600;

const MAX_BODY_HEIGHT = 300;
const LAYOUT: DataTableLayout = { maxHeight: MAX_BODY_HEIGHT, stickyHeader: true };

/** One batch, the way a cursor endpoint answers: the rows after `loadedCount`. */
export function fetchSectionBatch(loadedCount: number): readonly DocumentSection[] {
	return DOCUMENT_SECTIONS.slice(loadedCount, loadedCount + BATCH_SIZE);
}

/**
 * The rows arrive from a server a batch at a time. `isFetchingMore` is true while a request is out: the table shows
 * loading rows at the end and does not ask again until it settles.
 */
export function DataTable20Example(): React.JSX.Element {
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(() => fetchSectionBatch(0));
	const [isFetchingMore, setIsFetchingMore] = React.useState(false);
	const pendingRequest = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	// A request still out when the example leaves the page is dropped.
	React.useEffect(
		() => (): void => {
			if (pendingRequest.current !== null) {
				clearTimeout(pendingRequest.current);
			}
		},
		[],
	);

	const handleLoadMore = React.useCallback((): void => {
		if (pendingRequest.current !== null) {
			return;
		}
		setIsFetchingMore(true);
		pendingRequest.current = setTimeout((): void => {
			pendingRequest.current = null;
			setSections((current) => [...current, ...fetchSectionBatch(current.length)]);
			setIsFetchingMore(false);
		}, LATENCY_MS);
	}, []);

	const source = React.useMemo(
		(): DataTableInfiniteSource => ({ mode: "infinite", hasMore: sections.length < DOCUMENT_SECTIONS.length, isFetchingMore, onLoadMore: handleLoadMore }),
		[sections.length, isFetchingMore, handleLoadMore],
	);

	const heading = React.useMemo(
		(): DataTableHeading => ({ title: "Proposal sections", description: `Loaded ${String(sections.length)} of ${String(DOCUMENT_SECTIONS.length)}` }),
		[sections.length],
	);

	return <DataTable data={sections} columns={SECTION_COLUMNS} getRowId={getSectionId} source={source} heading={heading} layout={LAYOUT} />;
}
