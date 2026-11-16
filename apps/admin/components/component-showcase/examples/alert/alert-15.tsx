import * as React from "react";
import { ZapIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";

export function Alert15Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame>
				<FramePanel className="overflow-hidden p-0!">
					<Alert variant="invert" className="border-0 shadow-none">
						<ZapIcon className="text-warning" />
						<AlertTitle>Pro Feature</AlertTitle>
						<AlertAction>
							<Button variant="outline" size="xs" className="border-border/10 bg-background/10">
								Dismiss
							</Button>
							<Button size="xs" className="border-info bg-info text-status-foreground hover:border-info/90 hover:bg-info/90">
								Upgrade
							</Button>
						</AlertAction>
						<AlertDescription>This feature is only available for Pro users. Upgrade your plan to get access.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
