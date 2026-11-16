import BellIcon from "lucide-react-native/icons/bell";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert10Example(): React.JSX.Element {
	return (
		<Alert tone="neutral" icon={BellIcon} title="A new version is available">
			<Button label="Dismiss" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Update" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
