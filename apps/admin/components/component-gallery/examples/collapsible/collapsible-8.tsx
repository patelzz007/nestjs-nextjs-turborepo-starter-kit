import * as React from "react";
import { ChevronRightIcon, ClockIcon, MapPinIcon, MessageSquareIcon } from "lucide-react";
import { Frame, FrameHeader, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";

export function Collapsible8Example(): React.JSX.Element {
	return (
		<div className="h-54 w-full max-w-xs">
			<Frame stacked dense spacing="sm" className="w-full">
				<Collapsible defaultOpen>
					<CollapsibleTrigger className="flex w-full">
						<FrameHeader className="flex grow flex-row items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Avatar className="relative size-5">
									<AvatarImage src="https://github.com/shadcn.png" alt="User" />
									<AvatarFallback>JD</AvatarFallback>
								</Avatar>
								<span className="text-sm font-medium text-foreground">@shadcn</span>
							</div>
							<ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform in-aria-expanded:rotate-90" />
						</FrameHeader>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<FramePanel>
							{/* User profile information */}
							<div className="space-y-2.5">
								{/* Last activity */}
								<div className="flex items-center gap-2">
									<MessageSquareIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
									<span className="text-xs text-muted-foreground">Last activity:</span>
									<span className="text-xs font-medium text-foreground">2 hours ago</span>
								</div>
								{/* Online since */}
								<div className="flex items-center gap-2">
									<ClockIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
									<span className="text-xs text-muted-foreground">Online since:</span>
									<span className="text-xs font-medium text-foreground">Today, 9:00 AM</span>
								</div>
								{/* Location */}
								<div className="flex items-center gap-2">
									<MapPinIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
									<span className="text-xs text-muted-foreground">Location:</span>
									<div className="flex items-center gap-1.5">
										<span className="text-xs font-medium text-foreground">Canada</span>
									</div>
								</div>
							</div>
						</FramePanel>
					</CollapsibleContent>
				</Collapsible>
			</Frame>
		</div>
	);
}
