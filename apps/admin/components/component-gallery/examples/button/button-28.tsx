import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button28Example(): React.JSX.Element {
	return (
		<Button variant="link">
			<HelpCircleIcon aria-hidden="true" />
			Help Center
		</Button>
	);
}
