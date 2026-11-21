import { DataTable, type DataTableAction, type DataTableBoundAction } from "@workspace/ui-native/components/data-table";
import { DataTableCard, type DataTableCardField } from "@workspace/ui-native/components/data-table-card";
import EyeIcon from "lucide-react-native/icons/eye";
import * as React from "react";

import { useToast } from "../../../toast/facade";
import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION, SectionStatusBadge } from "./data-table-sample";

const PAGE_SIZE = 4;

function fieldsOf(item: DocumentSection): readonly DataTableCardField[] {
	return [
		{ label: "Type", value: item.type },
		{ label: "Target", value: item.target },
		{ label: "Limit", value: item.limit },
	];
}

/** Each row as this card instead of a table row, from the same data. */
function renderSectionCard(item: DocumentSection, actions: readonly DataTableBoundAction[]): React.ReactNode {
	return <DataTableCard title={item.header} subtitle={item.reviewer} badge={<SectionStatusBadge status={item.status} />} fields={fieldsOf(item)} actions={actions} />;
}

export function DataTable10Example(): React.JSX.Element {
	const toast = useToast();
	const actions = React.useMemo(
		(): DataTableAction<DocumentSection>[] => [
			{
				key: "open",
				label: "Open",
				description: "See the whole section",
				icon: EyeIcon,
				onPress: (row: DocumentSection): void => {
					toast.info(`Opened “${row.header}”`);
				},
			},
		],
		[toast],
	);
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			actions={actions}
			renderCard={renderSectionCard}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Cards"
			description="Each row as a card: the same rows, search and paging, read down the screen."
		/>
	);
}
