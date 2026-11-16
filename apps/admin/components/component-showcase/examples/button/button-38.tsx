import * as React from "react";
import { StarIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button38Example(): React.JSX.Element {
	return (
		<Button className="pe-0" variant="outline">
			<StarIcon aria-hidden="true" />
			Star
			<span className="relative ms-1 px-2 text-xs font-medium text-muted-foreground before:absolute before:inset-0 before:left-0 before:w-px before:bg-border">589</span>
		</Button>
	);
}
