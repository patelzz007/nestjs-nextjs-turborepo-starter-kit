import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";

export function Collapsible6Example(): React.JSX.Element {
	return (
		<div className="h-54 w-full max-w-xs">
			<Frame stacked dense spacing="sm" className="w-full">
				<Collapsible defaultOpen>
					<CollapsibleTrigger className="flex w-full">
						<FrameHeader className="flex grow flex-row items-center justify-between gap-2">
							<FrameTitle className="text-sm font-medium">Deployment successful</FrameTitle>
							<ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform in-aria-expanded:rotate-90" />
						</FrameHeader>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<FramePanel>
							<p className="text-xs leading-relaxed text-muted-foreground">
								Updated the core authentication logic and fixed a minor bug in the login flow. Improved session handling for better performance.
							</p>
						</FramePanel>
					</CollapsibleContent>
				</Collapsible>
			</Frame>
		</div>
	);
}
