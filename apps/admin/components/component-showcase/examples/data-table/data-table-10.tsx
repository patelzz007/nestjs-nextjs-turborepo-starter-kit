"use client";

import { Eye } from "lucide-react";
import * as React from "react";

import { DataTable, type Action } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 4;

/** Below `lg` each row renders as this card instead of a table row, from the same data. */
function renderSectionCard(item: DocumentSection, actions?: Action<DocumentSection>[]): React.ReactNode {
	return (
		<DataTableMobileCard
			item={item}
			title={item.header}
			subtitle={item.reviewer}
			badge={<SectionStatusBadge status={item.status} />}
			fields={[
				{ label: "Type", value: item.type },
				{ label: "Target", value: item.target },
				{ label: "Limit", value: item.limit },
			]}
			actions={actions}
		/>
	);
}

export function DataTable10Example(): React.JSX.Element {
	const actions = React.useMemo<Action<DocumentSection>[]>(
		() => [
			{
				key: "open",
				label: "Open",
				icon: <Eye />,
				onClick: (row): void => {
					toastMessage.info({ title: `Opened “${row.header}”` });
				},
			},
		],
		[],
	);
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			actions={actions}
			mobileCardRender={renderSectionCard}
			pageSize={PAGE_SIZE}
			title="Mobile cards"
			description="Narrow the window: below the lg breakpoint each row becomes a card."
		/>
	);
}
