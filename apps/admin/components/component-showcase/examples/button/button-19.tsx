import * as React from "react";
import { Settings2Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button19Example(): React.JSX.Element {
	return (
		<Button variant="outline">
			Options
			<Settings2Icon aria-hidden="true" />
		</Button>
	);
}
