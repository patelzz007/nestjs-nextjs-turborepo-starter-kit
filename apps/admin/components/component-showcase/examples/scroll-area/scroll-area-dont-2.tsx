import * as React from "react";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

export function ScrollAreaDont2Example(): React.JSX.Element {
	return (
		<ScrollArea className="h-48 w-48 rounded-lg border">
			<p className="p-3 text-sm">Version 1.9.0 is the latest release.</p>
		</ScrollArea>
	);
}
