import { Pagination } from "@workspace/ui-native/components/pagination";
import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";
import { Text, View } from "react-native";

/** How many pages the list has. */
const PAGE_COUNT = 10;
const SIZES: readonly NativeSelectOption<string>[] = [
	{ value: "10", label: "10 / page" },
	{ value: "20", label: "20 / page" },
];

export function Pagination15Example(): React.JSX.Element {
	const [page, setPage] = React.useState(1);
	const [size, setSize] = React.useState<string | null>("10");
	return (
		<View className="gap-3">
			<Text className="text-body font-sans text-muted-foreground">{`Page ${String(page)} of ${String(PAGE_COUNT)}`}</Text>
			<Pagination page={page} pageCount={PAGE_COUNT} onChange={setPage} pages="numbers" arrows="icons" showLastPage={false} siblingCount={2} size="sm" />
			<NativeSelect label="Per page" options={SIZES} value={size} onChange={setSize} size="sm" />
		</View>
	);
}
