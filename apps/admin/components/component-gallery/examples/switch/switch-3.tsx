import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";

export function Switch3Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-start justify-start gap-3">
			<div className="flex items-center gap-2">
				<Switch id="switch-disabled-unchecked" disabled />
				<Label htmlFor="switch-disabled-unchecked">Disabled (Unchecked)</Label>
			</div>
			<div className="flex items-center gap-2">
				<Switch id="switch-disabled-checked" defaultChecked disabled />
				<Label htmlFor="switch-disabled-checked">Disabled (Checked)</Label>
			</div>
		</div>
	);
}
