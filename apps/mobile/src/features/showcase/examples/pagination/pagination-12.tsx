import { Pagination } from "@workspace/ui-native/components/pagination";
import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";
import { Text, View } from "react-native";

/** How many rows the table has. */
const ROW_COUNT = 100;
const SIZES: readonly NativeSelectOption<string>[] = [
	{ value: "10", label: "10" },
	{ value: "25", label: "25" },
	{ value: "50", label: "50" },
];

export function Pagination12Example(): React.JSX.Element {
	const [size, setSize] = React.useState<string | null>("25");
	const [page, setPage] = React.useState(1);
	const perPage = Number(size ?? "25");
	const pageCount = Math.ceil(ROW_COUNT / perPage);
	const from = (page - 1) * perPage + 1;
	const to = Math.min(page * perPage, ROW_COUNT);
	const changeSize = React.useCallback((next: string | null): void => {
		setSize(next);
		setPage(1);
	}, []);
	return (
		<View className="gap-3">
			<NativeSelect label="Rows per page" options={SIZES} value={size} onChange={changeSize} size="sm" />
			<View className="flex-row items-center justify-between">
				<Text className="text-body font-sans text-muted-foreground tabular-nums">{`${String(from)}–${String(to)} of ${String(ROW_COUNT)}`}</Text>
				<Pagination page={page} pageCount={pageCount} onChange={setPage} pages="none" arrows="icons" showEdges size="sm" />
			</View>
		</View>
	);
}
