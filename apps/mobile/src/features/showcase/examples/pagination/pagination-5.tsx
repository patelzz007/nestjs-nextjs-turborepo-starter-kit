import { Button } from "@workspace/ui-native/components/button";
import { Input } from "@workspace/ui-native/components/input";
import { Pagination } from "@workspace/ui-native/components/pagination";
import * as React from "react";
import { View } from "react-native";

/** How many pages the list has. */
const PAGE_COUNT = 12;

export function Pagination5Example(): React.JSX.Element {
	const [page, setPage] = React.useState(1);
	const [typed, setTyped] = React.useState("");
	const goTo = React.useCallback((): void => {
		const target = Number(typed);
		if (Number.isInteger(target) && target >= 1 && target <= PAGE_COUNT) {
			setPage(target);
			setTyped("");
		}
	}, [typed]);
	return (
		<View className="gap-3">
			<Pagination page={page} pageCount={PAGE_COUNT} onChange={setPage} pages="numbers" arrows="icons" size="sm" showLastPage={false} />
			<View className="flex-row items-center gap-2">
				<Input
					value={typed}
					onChange={setTyped}
					placeholder="Page"
					accessibilityLabel="Go to page"
					keyboardType="number-pad"
					size="sm"
					className="w-20"
					onSubmitEditing={goTo}
				/>
				<Button label="Go" variant="outline" size="sm" onPress={goTo} />
			</View>
		</View>
	);
}
