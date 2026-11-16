import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { Text, View } from "react-native";

interface Figure {
	readonly label: string;
	readonly value: string;
}

const FIGURES: readonly Figure[] = [
	{ label: "Revenue", value: "$12,450" },
	{ label: "Users", value: "1,234" },
];

// A cover with only a spinner, inside the card it hides.
export function Spinner11Example(): React.JSX.Element {
	return (
		<Card>
			<CardContent className="gap-3">
				<Text className="text-label font-sans-semibold text-foreground">Dashboard Overview</Text>
				<Text className="text-label font-sans text-muted-foreground">Monthly revenue and user statistics for the current period.</Text>
				<View className="flex-row gap-3">
					{FIGURES.map((figure: Figure): React.JSX.Element => (
						<View key={figure.label} className="flex-1 rounded-md border border-border p-3">
							<Text className="text-caption font-sans text-muted-foreground">{figure.label}</Text>
							<Text className="text-title font-sans-bold text-foreground">{figure.value}</Text>
						</View>
					))}
				</View>
			</CardContent>
			<View className="rounded-card absolute inset-0 items-center justify-center bg-background/80">
				<Spinner variant="muted" accessibilityLabel="Loading" />
			</View>
		</Card>
	);
}
