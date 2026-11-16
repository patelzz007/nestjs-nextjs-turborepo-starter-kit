import { DataTable, type DataTableEmptyState } from "@workspace/ui-native/components/data-table";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import * as React from "react";
import { View } from "react-native";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;
const SKELETON_ROWS = 5;

type TableState = "loaded" | "loading" | "refetching" | "empty" | "error";

const STATES: readonly SegmentedOption<TableState>[] = [
	{ value: "loading", label: "Load" },
	{ value: "loaded", label: "Rows" },
	{ value: "refetching", label: "Refetch" },
	{ value: "empty", label: "Empty" },
	{ value: "error", label: "Error" },
];

const EMPTY: DataTableEmptyState = { title: "No sections yet", description: "Sections appear here once the proposal has some." };

export function DataTable11Example(): React.JSX.Element {
	const [state, setState] = React.useState<TableState>("loading");
	const retry = React.useCallback((): void => {
		setState("loaded");
	}, []);
	return (
		<View className="w-full gap-4">
			<SegmentedControl label="Table state" options={STATES} value={state} onChange={setState} />
			<DataTable
				data={state === "empty" ? [] : DOCUMENT_SECTIONS}
				columns={SECTION_COLUMNS}
				isLoading={state === "loading"}
				isRefetching={state === "refetching"}
				skeletonRows={SKELETON_ROWS}
				error={state === "error" ? "The sections could not be loaded. Try again in a moment." : null}
				onRetry={retry}
				emptyState={EMPTY}
				pagination={SECTION_PAGINATION}
				pageSize={PAGE_SIZE}
				title="Loading, empty and error"
				description="Every state a fetched table goes through, from skeleton rows to an error."
			/>
		</View>
	);
}
