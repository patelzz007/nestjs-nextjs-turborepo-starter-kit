import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert5Example(): React.JSX.Element {
	return (
		<Alert variant="info">
			<CircleAlertIcon />
			<AlertTitle>Info! Something important</AlertTitle>
			<AlertDescription>This is an important message. Please read it carefully.</AlertDescription>
		</Alert>
	);
}
