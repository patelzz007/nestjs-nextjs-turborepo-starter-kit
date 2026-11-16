import ActivityIcon from "lucide-react-native/icons/activity";
import DatabaseIcon from "lucide-react-native/icons/database";
import { View } from "react-native";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert17Example(): React.JSX.Element {
	return (
		<View className="rounded-card overflow-hidden border border-border">
			<Alert tone="success" variant="flush" icon={DatabaseIcon} title="Database" message="Connected · 12 ms" />
			<View className="h-px bg-border" />
			<Alert tone="warning" variant="flush" icon={ActivityIcon} title="API" message="Latency is high · 840 ms">
				<Button label="Retry" variant="outline" size="sm" onPress={ignorePress} />
			</Alert>
		</View>
	);
}
