import * as React from "react";
import { BoldIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function ToggleDo1Example(): React.JSX.Element {
	return (
		<Toggle aria-label="Bold" defaultPressed>
			<BoldIcon aria-hidden="true" />
		</Toggle>
	);
}
