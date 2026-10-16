import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert9Example(): React.JSX.Element {
	return (
		<Alert variant="invert">
			<CircleAlertIcon className="text-success" />
			<AlertTitle>Notification! All good</AlertTitle>
			<AlertDescription>This is a notification alert with a title and description.</AlertDescription>
		</Alert>
	);
}
