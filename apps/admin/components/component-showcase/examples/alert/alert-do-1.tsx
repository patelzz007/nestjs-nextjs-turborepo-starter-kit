import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { CircleAlertIcon } from "lucide-react";

export function AlertDo1Example(): React.JSX.Element {
	return (
		<Alert variant="destructive" className="max-w-md">
			<CircleAlertIcon aria-hidden="true" />
			<AlertTitle>Your card was declined</AlertTitle>
			<AlertDescription>Check the card number and expiry, or pay with another card.</AlertDescription>
		</Alert>
	);
}
