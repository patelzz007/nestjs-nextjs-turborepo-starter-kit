import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import * as React from "react";
import { Text, View } from "react-native";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIODS: readonly SegmentedOption<Period>[] = [
	{ value: "daily", label: "Daily" },
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "yearly", label: "Yearly" },
];
const VISITORS: Readonly<Record<Period, string>> = { daily: "1,284", weekly: "8,910", monthly: "38,402", yearly: "461,117" };

export function Tabs9Example(): React.JSX.Element {
	const [period, setPeriod] = React.useState<Period>("weekly");
	return (
		<View className="gap-4">
			<SegmentedControl label="Period" options={PERIODS} value={period} onChange={setPeriod} />
			<View className="gap-1">
				<Text className="text-caption font-sans text-muted-foreground">Visitors</Text>
				<Text className="text-h1 font-heading text-foreground tabular-nums">{VISITORS[period]}</Text>
			</View>
		</View>
	);
}
