import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button29Example(): React.JSX.Element {
	return (
		<Button variant="link" className="group/link-button">
			View Documentation
			<ArrowUpRightIcon aria-hidden="true" className="transition-transform group-hover/link-button:rotate-45" />
		</Button>
	);
}
