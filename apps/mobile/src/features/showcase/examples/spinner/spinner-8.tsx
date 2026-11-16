import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { Text, View } from "react-native";

export function Spinner8Example(): React.JSX.Element {
	return (
		<Card>
			<CardContent className="min-h-48 items-center justify-center gap-4">
				<Spinner variant="muted" accessibilityLabel="Setting up your workspace" />
				<View className="items-center gap-1">
					<Text className="text-label font-sans-medium text-foreground">Setting up your workspace</Text>
					<Text className="text-caption font-sans text-muted-foreground">This may take a few seconds…</Text>
				</View>
			</CardContent>
		</Card>
	);
}
