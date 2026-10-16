import * as React from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button25Example(): React.JSX.Element {
	return (
		<Button size="icon-sm" variant="ghost" aria-label="Notifications">
			<BellIcon aria-hidden="true" />
		</Button>
	);
}
