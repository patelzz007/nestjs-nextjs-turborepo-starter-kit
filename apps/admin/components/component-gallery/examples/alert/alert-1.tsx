import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert1Example(): React.JSX.Element {
	return (
		<Alert>
			<AlertTitle>Alert!</AlertTitle>
			<AlertDescription>This is an alert with a title and description.</AlertDescription>
		</Alert>
	);
}
