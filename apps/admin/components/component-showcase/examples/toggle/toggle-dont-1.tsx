import * as React from "react";
import { BoldIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function ToggleDont1Example(): React.JSX.Element {
	return (
		<Toggle aria-label="Make bold" defaultPressed>
			<BoldIcon aria-hidden="true" />
		</Toggle>
	);
}
