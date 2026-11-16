import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader, DataGridPagination, DataGridRowSelect, DataGridRowSelectAll } from "@workspace/ui-native/components/data-grid-parts";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";
import type { NativeDataGridLabels } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { View } from "react-native";

import { BalanceCell, COLUMN_WIDTH, PersonCell, usePeopleTable, type PersonColumns } from "./data-grid-sample";
import { DATA_GRID_SAMPLE_PEOPLE } from "./data-grid-sample-people";

type Language = "en" | "de" | "ja";

/** The grid's words in German and Japanese: only what this grid shows; the rest stay English. */
const LABELS: Readonly<Record<Language, Partial<NativeDataGridLabels>>> = {
	en: {},
	de: {
		sortAscending: "Aufsteigend",
		sortDescending: "Absteigend",
		selectRow: "Zeile auswählen",
		selectAll: "Alle auswählen",
		rowsPerPage: "Zeilen pro Seite",
		paginationInfo: ({ from, to, count }): string => `${String(from)}–${String(to)} von ${String(count)}`,
		empty: "Keine Daten",
	},
	ja: {
		sortAscending: "昇順",
		sortDescending: "降順",
		selectRow: "行を選択",
		selectAll: "すべて選択",
		rowsPerPage: "1ページの行数",
		paginationInfo: ({ from, to, count }): string => `${String(count)}件中 ${String(from)}–${String(to)}`,
		empty: "データがありません",
	},
};
/** A language's header titles. */
interface ColumnTitles {
	readonly name: string;
	readonly balance: string;
}

const TITLES: Readonly<Record<Language, ColumnTitles>> = {
	en: { name: "Name", balance: "Balance" },
	de: { name: "Name", balance: "Kontostand" },
	ja: { name: "名前", balance: "残高" },
};
const LANGUAGES: readonly { readonly value: Language; readonly label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
	{ value: "ja", label: "日本語" },
];
const SELECT_WIDTH = 48;

/** The grid's columns, their header titles in the language on show. */
function personColumns(titles: ColumnTitles): PersonColumns {
	return [
		{
			id: "select",
			header: () => <DataGridRowSelectAll />,
			cell: ({ row }) => <DataGridRowSelect row={row} />,
			size: SELECT_WIDTH,
			enableSorting: false,
		},
		{
			accessorKey: "name",
			header: ({ column }) => <DataGridColumnHeader column={column} />,
			cell: PersonCell,
			size: COLUMN_WIDTH.person,
			meta: { headerTitle: titles.name },
		},
		{
			accessorKey: "balance",
			header: ({ column }) => <DataGridColumnHeader column={column} />,
			cell: BalanceCell,
			size: COLUMN_WIDTH.balance,
			meta: { headerTitle: titles.balance, align: "end" },
		},
	];
}

// One switch swaps the grid's built-in words (sort, selection, pager) between English, German and Japanese.
export function DataGrid33Example(): React.JSX.Element {
	const [language, setLanguage] = React.useState<Language>("en");
	const titles = TITLES[language];
	const columns = React.useMemo((): PersonColumns => personColumns(titles), [titles]);
	const table = usePeopleTable({ columns, options: { enableRowSelection: true } });
	return (
		<View className="w-full gap-3">
			<SegmentedControl label="Language" options={LANGUAGES} value={language} onChange={setLanguage} />
			<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length} labels={LABELS[language]} tableLayout={{ columnsMovable: true }}>
				<View className="gap-2.5">
					<DataGridContainer>
						<DataGridTable />
					</DataGridContainer>
					<DataGridPagination />
				</View>
			</DataGrid>
		</View>
	);
}
