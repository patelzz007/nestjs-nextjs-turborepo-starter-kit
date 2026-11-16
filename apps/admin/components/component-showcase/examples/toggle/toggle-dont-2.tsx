import * as React from "react";
import { Toggle } from "@workspace/ui/components/toggle";

export function ToggleDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-64 items-center justify-between rounded-md border border-border p-3">
			<span className="text-sm">Email notifications</span>
			<Toggle aria-label="Email notifications" variant="outline" size="sm">
				On
			</Toggle>
		</div>
	);
}
