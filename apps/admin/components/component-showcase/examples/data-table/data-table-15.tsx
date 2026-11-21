"use client";

import { FileText } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { Button } from "@workspace/ui/components/button";
import { DataTable, type DataTableEmptyState, type DataTableHeading, type DataTableStatus } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const viewSchema = z.enum(["loading", "refreshing", "empty", "error", "ready"]);
type View = z.output<typeof viewSchema>;

const VIEW_LABELS: Readonly<Record<View, string>> = { loading: "First load", refreshing: "Refreshing", empty: "Empty", error: "Error", ready: "Ready" };

const SHOWN_SECTION_COUNT = 5;
const SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);
const NO_SECTIONS: readonly DocumentSection[] = [];

/** `"initial"` replaces the rows with skeletons; `"refreshing"` keeps the rows on screen, dimmed. */
const FIRST_LOAD: DataTableStatus = { loading: "initial", skeletonRows: SHOWN_SECTION_COUNT };
const REFRESHING: DataTableStatus = { loading: "refreshing" };

/** A table can hold rows in two of the five views only. */
function rowsOf(view: View): readonly DocumentSection[] {
	return view === "ready" || view === "refreshing" ? SECTIONS : NO_SECTIONS;
}

/**
 * The states a table moves through, picked by the buttons in the heading: skeleton rows on a first load, dimmed rows
 * on a refresh, your own empty state, and an error with a retry.
 */
export function DataTable15Example(): React.JSX.Element {
	const [view, setView] = React.useState<View>("loading");

	const handleViewClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const next = viewSchema.safeParse(event.currentTarget.dataset.view);
		if (next.success) {
			setView(next.data);
		}
	}, []);

	const showReady = React.useCallback((): void => {
		setView("ready");
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Proposal sections",
			actions: (
				<div className="flex flex-wrap gap-1">
					{viewSchema.options.map((option) => (
						<Button key={option} size="sm" variant={option === view ? "default" : "outline"} aria-pressed={option === view} data-view={option} onClick={handleViewClick}>
							{VIEW_LABELS[option]}
						</Button>
					))}
				</div>
			),
		}),
		[view, handleViewClick],
	);

	const status = React.useMemo((): DataTableStatus | undefined => {
		if (view === "loading") {
			return FIRST_LOAD;
		}
		if (view === "refreshing") {
			return REFRESHING;
		}
		// With no rows an error replaces them; `onRetry` adds the retry button.
		return view === "error" ? { error: "The sections could not be loaded.", onRetry: showReady } : undefined;
	}, [view, showReady]);

	// Shown when the table has no rows at all. A search or a filter that hides every row has its own built-in state.
	const emptyState = React.useMemo(
		(): DataTableEmptyState => ({
			icon: <FileText aria-hidden="true" />,
			title: "No sections yet",
			description: "Add the first section to start the proposal.",
			action: { label: "Add section", onClick: showReady },
		}),
		[showReady],
	);

	return <DataTable data={rowsOf(view)} columns={SECTION_COLUMNS} getRowId={getSectionId} heading={heading} status={status} emptyState={emptyState} />;
}
