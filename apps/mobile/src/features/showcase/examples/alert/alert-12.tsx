import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import { View } from "react-native";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert12Example(): React.JSX.Element {
	return (
		<View className="rounded-card overflow-hidden border border-border">
			<Alert tone="error" variant="flush" icon={RefreshCwIcon} title="System update" message="The service restarts at 02:00 UTC for about 5 minutes." />
		</View>
	);
}
