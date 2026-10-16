import * as React from "react";
import { SettingsIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button20Example(): React.JSX.Element {
	return (
		<Button variant="ghost">
			<SettingsIcon aria-hidden="true" />
			Settings
		</Button>
	);
}
