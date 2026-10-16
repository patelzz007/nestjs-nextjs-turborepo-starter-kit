import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";

export function Frame5Example(): React.JSX.Element {
	return (
		<Frame className="w-full" stacked>
			<Collapsible defaultOpen className="group/collapsible">
				<CollapsibleTrigger className="w-full">
					<FrameHeader className="flex grow flex-row items-center justify-between gap-2">
						<FrameTitle>Start</FrameTitle>
						<ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-90" />
					</FrameHeader>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<FramePanel>
						<p className="text-sm text-muted-foreground">Initialize run to answer a user question using uploaded files and the knowledge base; cite sources when relevant.</p>
					</FramePanel>
				</CollapsibleContent>
			</Collapsible>
		</Frame>
	);
}
