import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { Text, View } from "react-native";

// Status lines, each led by a small spinner; two tinted to say how the connection is going.
export function Spinner9Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-2">
				<Spinner variant="muted" accessibilityLabel="Checking availability" />
				<Text className="text-label font-sans text-muted-foreground">Checking availability…</Text>
			</View>
			<View className="flex-row items-center gap-2">
				<Spinner colorClassName="accent-success" accessibilityLabel="Syncing data" />
				<Text className="text-label font-sans text-muted-foreground">
					<Text className="font-sans-medium text-success-foreground">Connected</Text> — syncing data
				</Text>
			</View>
			<View className="flex-row items-center gap-2">
				<Spinner colorClassName="accent-warning" accessibilityLabel="Reconnecting" />
				<Text className="text-label font-sans text-muted-foreground">
					<Text className="font-sans-medium text-warning-foreground">Reconnecting</Text> — attempt 3 of 5
				</Text>
			</View>
		</View>
	);
}
