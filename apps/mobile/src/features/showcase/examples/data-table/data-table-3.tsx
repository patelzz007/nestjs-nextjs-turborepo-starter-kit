import { DataTable, type DataTableAction } from "@workspace/ui-native/components/data-table";
import type { NativeDataTableLabels } from "@workspace/ui-native/lib/data-table";
import CopyIcon from "lucide-react-native/icons/copy";
import EyeIcon from "lucide-react-native/icons/eye";
import PencilIcon from "lucide-react-native/icons/pencil";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";

import { useToast } from "../../../toast/facade";
import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

const PAGE_SIZE = 5;

/** Only the strings that differ from the kit's copy: the menu names the record. */
const LABELS: Partial<NativeDataTableLabels> = { actionsMenuTitle: "Section actions", openRowMenu: "Open section row menu" };

export function DataTable3Example(): React.JSX.Element {
	const toast = useToast();
	const actions = React.useMemo(
		(): DataTableAction<DocumentSection>[] => [
			{
				key: "view",
				label: "View",
				description: "Open the section preview",
				icon: EyeIcon,
				onPress: (row: DocumentSection): void => {
					toast.info(`Viewing “${row.header}”`);
				},
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit section details",
				icon: PencilIcon,
				onPress: (row: DocumentSection): void => {
					toast.success(`Editing “${row.header}”`);
				},
			},
			{
				key: "duplicate",
				label: "Make a copy",
				description: "Add a copy under this section",
				icon: CopyIcon,
				onPress: (row: DocumentSection): void => {
					toast.success(`Duplicated “${row.header}”`);
				},
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this section",
				icon: Trash2Icon,
				tone: "destructive",
				onPress: (row: DocumentSection): void => {
					toast.error("A demo: nothing was removed.", { title: `Deleted “${row.header}”` });
				},
			},
		],
		[toast],
	);
	const handleRowPress = React.useCallback(
		(row: DocumentSection): void => {
			toast.info("The ⋯ menu holds the row's actions.", { title: `Opened “${row.header}”` });
		},
		[toast],
	);
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			actions={actions}
			onRowPress={handleRowPress}
			labels={LABELS}
			pageSize={PAGE_SIZE}
			title="Row actions"
			description="Tap a row to open it, or use its ⋯ menu."
		/>
	);
}
