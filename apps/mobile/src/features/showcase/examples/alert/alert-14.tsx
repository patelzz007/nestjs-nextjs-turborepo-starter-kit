import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import { View } from "react-native";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert14Example(): React.JSX.Element {
	return (
		<View className="rounded-card overflow-hidden border border-border">
			<Alert
				tone="neutral"
				variant="flush"
				icon={ShieldCheckIcon}
				iconColorClassName="accent-success"
				title="Security checkup"
				message="Review your active sessions and recovery codes. It takes about two minutes and keeps your account safe.">
				<Button label="Dismiss" variant="outline" size="sm" onPress={ignorePress} />
				<Button label="Update" size="sm" onPress={ignorePress} />
			</Alert>
		</View>
	);
}
