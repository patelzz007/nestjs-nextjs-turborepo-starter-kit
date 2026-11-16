import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

interface Line {
	readonly label: string;
	readonly amount: string;
	readonly discount?: boolean | undefined;
}

const LINES: readonly Line[] = [
	{ label: "Subtotal", amount: "$49.00" },
	{ label: "Discount", amount: "-$5.00", discount: true },
	{ label: "Tax", amount: "$3.52" },
];

export function Separator6Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<Text className="text-label font-sans-medium text-foreground">Order Summary</Text>
			<Separator />
			{LINES.map((line: Line): React.JSX.Element => (
				<View key={line.label} className="flex-row items-center justify-between">
					<Text className="text-label font-sans text-muted-foreground">{line.label}</Text>
					<Text className={line.discount === true ? "text-label font-sans text-success-foreground tabular-nums" : "text-label font-sans text-foreground tabular-nums"}>
						{line.amount}
					</Text>
				</View>
			))}
			<Separator />
			<View className="flex-row items-center justify-between">
				<Text className="text-label font-sans-medium text-foreground">Total</Text>
				<Text className="text-label font-sans-medium text-foreground tabular-nums">$47.52</Text>
			</View>
		</View>
	);
}
