import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { TriangleAlertIcon } from "lucide-react";

/** A pale yellow: white text on it fails contrast. */
const PALE_BACKGROUND: React.CSSProperties = { backgroundColor: "#facc15" };

export function ColorPickerDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-3">
			<div className="rounded-md p-3 text-sm text-white" style={PALE_BACKGROUND}>
				Pay invoice
			</div>
			<Alert>
				<TriangleAlertIcon aria-hidden="true" />
				<AlertTitle>Hard to read</AlertTitle>
				<AlertDescription>White text on this yellow has a contrast of 1.6:1; buttons need 4.5:1.</AlertDescription>
			</Alert>
		</div>
	);
}
