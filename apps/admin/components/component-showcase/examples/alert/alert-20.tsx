import * as React from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Alert20Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame>
				<FramePanel className="overflow-hidden p-0!">
					<Alert variant="invert" className="grid-cols-[32px_1fr] gap-x-3 border-0 shadow-none">
						<Avatar className="size-8 border border-border/10">
							<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
							<AvatarFallback>SC</AvatarFallback>
						</Avatar>
						<AlertTitle className="flex items-center gap-2">
							<span className="truncate">Sarah Chen</span>
							<span className="truncate font-normal text-invert-foreground/60">mentioned you in a comment</span>
						</AlertTitle>
						<AlertAction>
							<Button variant="outline" size="xs" className="border-border/10 bg-background/10">
								Dismiss
							</Button>
							<Button size="xs" className="border-info bg-info text-status-foreground hover:border-info/90 hover:bg-info/90">
								View
							</Button>
						</AlertAction>
						<AlertDescription className="line-clamp-1 text-invert-foreground/70">
							&quot;Great work on the user profile layout! I&apos;ve added some suggestions for the avatar spacing.&quot;
						</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
