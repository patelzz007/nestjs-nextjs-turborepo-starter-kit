import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { Text, View } from "react-native";

interface Figure {
	readonly label: string;
	readonly value: string;
}

const FIGURES: readonly Figure[] = [
	{ label: "Revenue", value: "$12,450" },
	{ label: "Growth", value: "+18.2%" },
	{ label: "Users", value: "1,248" },
];

const TITLE = "Monthly Report";
const DESCRIPTION = "Revenue and growth metrics.";

// A cover over the card while it refreshes: the figures stay in place, dimmed, under a caption.
export function Spinner7Example(): React.JSX.Element {
	return (
		<View>
			<Card>
				<CardHeader>
					<CardTitle>{TITLE}</CardTitle>
					<CardDescription>{DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent className="gap-3">
					{FIGURES.map((figure: Figure): React.JSX.Element => (
						<View key={figure.label} className="flex-row justify-between">
							<Text className="text-label font-sans text-muted-foreground">{figure.label}</Text>
							<Text className="text-label font-sans-medium text-foreground">{figure.value}</Text>
						</View>
					))}
				</CardContent>
			</Card>
			<View className="rounded-card absolute inset-0 items-center justify-center gap-2 bg-background/80">
				<Spinner variant="muted" accessibilityLabel="Refreshing data" />
				<Text className="text-label font-sans text-muted-foreground">Refreshing data…</Text>
			</View>
		</View>
	);
}
