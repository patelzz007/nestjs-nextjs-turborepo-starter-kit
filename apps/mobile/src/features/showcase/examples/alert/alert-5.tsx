import InfoIcon from "lucide-react-native/icons/info";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert5Example(): React.JSX.Element {
	return (
		<Alert tone="info" icon={InfoIcon} title="New feature available" message="Try the new dashboard view from Settings.">
			<Button label="Dismiss" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Update" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
