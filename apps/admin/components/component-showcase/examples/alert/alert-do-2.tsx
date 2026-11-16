import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { CircleCheckIcon } from "lucide-react";

export function AlertDo2Example(): React.JSX.Element {
	return (
		<Alert variant="success" className="max-w-md">
			<CircleCheckIcon aria-hidden="true" />
			<AlertTitle>Payment received</AlertTitle>
			<AlertDescription>We emailed the receipt to ada@example.com.</AlertDescription>
		</Alert>
	);
}
