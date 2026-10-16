import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert7Example(): React.JSX.Element {
	return (
		<Alert variant="warning">
			<AlertTriangleIcon />
			<AlertTitle>Warning! Something is wrong</AlertTitle>
			<AlertDescription>Please check your settings. If the problem persists, contact support.</AlertDescription>
		</Alert>
	);
}
