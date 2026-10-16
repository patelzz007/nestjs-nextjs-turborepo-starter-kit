import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert8Example(): React.JSX.Element {
	return (
		<Alert variant="destructive">
			<CircleAlertIcon />
			<AlertTitle>Error! Something went wrong</AlertTitle>
			<AlertDescription>Please try again. If the problem persists, contact support.</AlertDescription>
		</Alert>
	);
}
