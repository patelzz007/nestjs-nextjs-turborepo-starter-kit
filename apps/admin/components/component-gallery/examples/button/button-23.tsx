import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button23Example(): React.JSX.Element {
	return (
		<Button variant="destructive">
			Confirm Removal
			<CircleAlertIcon aria-hidden="true" />
		</Button>
	);
}
