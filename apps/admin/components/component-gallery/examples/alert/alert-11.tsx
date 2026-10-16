import * as React from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@workspace/ui/components/alert";

import { Button } from "@workspace/ui/components/button";

export function Alert11Example(): React.JSX.Element {
	return (
		<Alert>
			<ShieldCheckIcon />
			<AlertDescription>Update your password and enable 2FA.</AlertDescription>
			<AlertAction>
				<Button variant="outline" size="xs">
					Dismiss
				</Button>
				<Button size="xs">Update</Button>
			</AlertAction>
		</Alert>
	);
}
