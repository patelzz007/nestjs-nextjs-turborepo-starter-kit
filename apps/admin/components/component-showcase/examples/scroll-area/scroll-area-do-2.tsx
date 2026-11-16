import * as React from "react";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

const RELEASES: readonly string[] = ["v1.9.0", "v1.8.2", "v1.8.1", "v1.8.0", "v1.7.4", "v1.7.3", "v1.7.0", "v1.6.1", "v1.6.0", "v1.5.0", "v1.4.2", "v1.4.0"];

export function ScrollAreaDo2Example(): React.JSX.Element {
	return (
		<ScrollArea className="h-48 w-48 rounded-lg border">
			<div className="flex flex-col divide-y p-3">
				{RELEASES.map((release: string): React.JSX.Element => (
					<div key={release} className="py-2 text-sm">
						{release}
					</div>
				))}
			</div>
		</ScrollArea>
	);
}
