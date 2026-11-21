"use client";

import { Copy, Eye, Send, Trash2 } from "lucide-react";
import * as React from "react";

import { DataTable, type DataTableRowAction } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, type DocumentSection } from "./data-table-sample";

function viewSection(section: DocumentSection): void {
	toastMessage.info({ title: `Viewing "${section.header}"`, description: `Section type: ${section.type}` });
}

/** How long the pretend server takes to publish a section. */
const PUBLISH_LATENCY_MS = 800;

/**
 * Publishes a section the way a request would: it takes a moment, and it is refused for a section still in
 * progress. Returning the promise is all the table needs to show the wait and, on a refusal, a retry button.
 */
export function publishSection(section: DocumentSection): Promise<void> {
	return new Promise<void>((resolve, reject): void => {
		setTimeout((): void => {
			if (section.status === "Done") {
				toastMessage.success({ title: `Published "${section.header}"` });
				resolve();
			} else {
				reject(new Error(`"${section.header}" is still in progress`));
			}
		}, PUBLISH_LATENCY_MS);
	});
}

/**
 * An inline button and the ⋯ menu at the end of each row. `tone: "destructive"` marks the entry that removes
 * something. An action that returns a promise shows a spinner while it runs, and a retry button if it fails.
 */
export function DataTable3Example(): React.JSX.Element {
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<DocumentSection>[] => [
			// `inline`: a button in the row itself. Publishing an "In Process" section fails, to show the retry.
			{ key: "publish", label: "Publish", description: "Send the section to the reviewer", icon: <Send aria-hidden="true" />, inline: true, onSelect: publishSection },
			{ key: "view", label: "View", description: "Open the whole section", icon: <Eye aria-hidden="true" />, onSelect: viewSection },
			{
				key: "duplicate",
				label: "Duplicate",
				description: "Adds a copy under this section",
				icon: <Copy aria-hidden="true" />,
				onSelect: (section: DocumentSection): void => {
					setSections((current) => {
						const copy: DocumentSection = { ...section, id: `${section.id}-copy-${String(current.length)}`, header: `${section.header} (copy)` };
						const position = current.findIndex((entry) => entry.id === section.id);
						return [...current.slice(0, position + 1), copy, ...current.slice(position + 1)];
					});
				},
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this section from the proposal",
				icon: <Trash2 aria-hidden="true" />,
				tone: "destructive",
				onSelect: (section: DocumentSection): void => {
					setSections((current) => current.filter((entry) => entry.id !== section.id));
				},
			},
		],
		[],
	);

	return <DataTable data={sections} columns={SECTION_COLUMNS} getRowId={getSectionId} rowActions={rowActions} paging={SECTION_PAGING} />;
}
