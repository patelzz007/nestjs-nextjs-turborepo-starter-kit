import SparklesIcon from "lucide-react-native/icons/sparkles";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert18Example(): React.JSX.Element {
	return (
		<Alert tone="info" icon={SparklesIcon} title="Discover workflows" message="Automate the busywork with rules that run on their own." onDismiss={ignorePress}>
			<Button label="Explore features" variant="link" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
