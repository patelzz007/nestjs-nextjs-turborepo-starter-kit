import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import { View } from "react-native";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert13Example(): React.JSX.Element {
	return (
		<View className="rounded-card overflow-hidden border border-border">
			<Alert tone="success" variant="flush" icon={CircleCheckIcon} title="Deployed" message="Production is running v2.4.0." />
			<View className="h-px bg-border" />
			<Alert tone="warning" variant="flush" icon={TriangleAlertIcon} title="Resource limit" message="You have used 90% of your build minutes.">
				<Button label="Verify" variant="outline" size="sm" onPress={ignorePress} />
			</Alert>
		</View>
	);
}
