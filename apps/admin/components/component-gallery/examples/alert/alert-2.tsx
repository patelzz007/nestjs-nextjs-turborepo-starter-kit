import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert2Example(): React.JSX.Element {
	return (
		<Alert>
			<CircleCheckIcon />
			<AlertTitle>Alert!</AlertTitle>
			<AlertDescription>This is an alert with icon, title and description.</AlertDescription>
		</Alert>
	);
}
