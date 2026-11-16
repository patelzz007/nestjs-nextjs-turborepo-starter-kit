import * as React from "react";
import { Alert, AlertTitle } from "@workspace/ui/components/alert";

export function AlertDont1Example(): React.JSX.Element {
	return (
		<Alert variant="destructive" className="max-w-md">
			<AlertTitle>Error 402</AlertTitle>
		</Alert>
	);
}
