import ZapIcon from "lucide-react-native/icons/zap";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert15Example(): React.JSX.Element {
	return (
		<Alert tone="invert" icon={ZapIcon} iconColorClassName="accent-warning" title="Go Pro" message="Unlimited projects, more seats and priority support.">
			<Button label="Dismiss" variant="ghost" size="sm" onPress={ignorePress} />
			<Button label="Upgrade" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
