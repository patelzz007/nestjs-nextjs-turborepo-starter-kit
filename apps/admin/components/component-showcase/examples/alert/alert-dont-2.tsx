import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { CircleAlertIcon } from "lucide-react";

export function AlertDont2Example(): React.JSX.Element {
	return (
		<Alert variant="destructive" className="max-w-md">
			<CircleAlertIcon aria-hidden="true" />
			<AlertTitle>Payment received</AlertTitle>
			<AlertDescription>We emailed the receipt to ada@example.com.</AlertDescription>
		</Alert>
	);
}
