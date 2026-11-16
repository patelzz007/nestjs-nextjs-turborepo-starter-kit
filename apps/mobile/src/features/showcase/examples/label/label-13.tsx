import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import { Label } from "@workspace/ui-native/components/text";
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import * as React from "react";
import { View } from "react-native";

export function Label13Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-between">
			<Label>Server status</Label>
			<StatusBadge icon={CircleDotIcon} label="Online" accessibilityLabel="Server status: online" tone="success" pulsing />
		</View>
	);
}
