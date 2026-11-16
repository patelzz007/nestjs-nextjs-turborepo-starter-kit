import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";

export function Alert6Example(): React.JSX.Element {
	return (
		<Alert variant="success">
			<CircleCheckIcon />
			<AlertTitle>Success! All good</AlertTitle>
			<AlertDescription>Everything is working as expected. You can continue with your task.</AlertDescription>
		</Alert>
	);
}
