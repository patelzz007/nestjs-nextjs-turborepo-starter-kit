import ShieldIcon from "lucide-react-native/icons/shield";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert3Example(): React.JSX.Element {
	return (
		<Alert tone="neutral" icon={ShieldIcon} title="Security update available" message="Update to the latest version to stay protected.">
			<Button label="Dismiss" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Update" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
