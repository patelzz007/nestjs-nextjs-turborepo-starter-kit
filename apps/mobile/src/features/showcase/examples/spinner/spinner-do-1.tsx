import { Text, View } from "react-native";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";

export function SpinnerDo1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Spinner variant="muted" accessibilityLabel="Loading invoices" />
			<Text className="text-label font-sans text-muted-foreground">Loading invoices…</Text>
		</View>
	);
}
