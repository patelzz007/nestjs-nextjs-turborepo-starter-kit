import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert11Example(): React.JSX.Element {
	return (
		<Alert tone="neutral" message="Turn on two-factor sign-in to protect your account.">
			<Button label="Dismiss" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Update" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
