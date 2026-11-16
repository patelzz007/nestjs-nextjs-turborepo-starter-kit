"use client";

import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { DataTable, type Action } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 5;

/** Only the strings that differ from the kit's `dataTable` copy: the menu names the record. */
const LABELS: UiKitLabelsOverride<"dataTable"> = { actionsMenuTitle: "Section actions", openRowMenu: "Open section row menu" };

export function DataTable3Example(): React.JSX.Element {
	const actions = React.useMemo(
		(): Action<DocumentSection>[] => [
			{
				key: "view",
				label: "View",
				description: "Open the section preview",
				icon: <Eye />,
				onClick: (row): void => {
					toastMessage.info({ title: `Viewing “${row.header}”` });
				},
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit section details",
				icon: <Pencil />,
				onClick: (row): void => {
					toastMessage.success({ title: `Editing “${row.header}”` });
				},
			},
			{
				key: "duplicate",
				label: "Make a copy",
				icon: <Copy />,
				onClick: (row): void => {
					toastMessage.success({ title: `Duplicated “${row.header}”` });
				},
			},
			{
				key: "delete",
				label: "Delete",
				icon: <Trash2 />,
				isDestructive: true,
				onClick: (row): void => {
					toastMessage.error({ title: `Deleted “${row.header}”`, description: "A demo: nothing was removed." });
				},
			},
		],
		[],
	);
	const handleRowClick = React.useCallback((row: DocumentSection): void => {
		toastMessage.info({ title: `Opened “${row.header}”`, description: "The ⋯ menu holds the row's actions." });
	}, []);

	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			actions={actions}
			onRowClick={handleRowClick}
			labels={LABELS}
			pageSize={PAGE_SIZE}
			title="Row actions"
			description="Click a row to open it, or use its ⋯ menu."
		/>
	);
}
