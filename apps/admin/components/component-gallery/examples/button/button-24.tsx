import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button24Example(): React.JSX.Element {
	return (
		<Button size="icon-xs" variant="outline" aria-label="Close">
			<XIcon aria-hidden="true" />
		</Button>
	);
}
