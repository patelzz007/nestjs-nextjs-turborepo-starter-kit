import * as React from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Alert, AlertAction, AlertTitle } from "@workspace/ui/components/alert";

import { Button } from "@workspace/ui/components/button";

export function Alert10Example(): React.JSX.Element {
	return (
		<Alert>
			<ShieldCheckIcon />
			<AlertTitle>Update your password and enable 2FA.</AlertTitle>
			<AlertAction>
				<Button variant="outline" size="xs">
					Dismiss
				</Button>
				<Button size="xs">Update</Button>
			</AlertAction>
		</Alert>
	);
}
