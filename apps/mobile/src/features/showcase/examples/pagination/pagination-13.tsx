import { Pagination } from "@workspace/ui-native/components/pagination";
import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";
import { View } from "react-native";

/** How many pages the list has. */
const PAGE_COUNT = 10;
const PAGES: readonly NativeSelectOption<string>[] = Array.from({ length: PAGE_COUNT }, (_page: undefined, index: number): NativeSelectOption<string> => ({
	value: String(index + 1),
	label: `Page ${String(index + 1)}`,
}));

export function Pagination13Example(): React.JSX.Element {
	const [page, setPage] = React.useState(1);
	const choose = React.useCallback((value: string | null): void => {
		setPage(Number(value ?? "1"));
	}, []);
	return (
		<View className="flex-row items-center gap-2">
			<Pagination page={page} pageCount={PAGE_COUNT} onChange={setPage} pages="none" arrows="icons" showEdges size="sm" className="flex-1" />
			<NativeSelect label="Page" options={PAGES} value={String(page)} onChange={choose} size="sm" className="w-32" />
		</View>
	);
}
