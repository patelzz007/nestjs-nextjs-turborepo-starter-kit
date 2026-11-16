import CreditCardIcon from "lucide-react-native/icons/credit-card";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Alert16Example(): React.JSX.Element {
	return (
		<Alert tone="error" icon={CreditCardIcon} title="Your subscription expires in 3 days" message="Renew now to keep your projects online.">
			<Button label="Renew now" variant="destructive" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
