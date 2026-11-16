import * as React from "react";
import { DatabaseIcon, GlobeIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";

export function Alert17Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame stacked>
				<FramePanel className="overflow-hidden p-0!">
					<Alert variant="success" className="border-0 bg-transparent shadow-none">
						<DatabaseIcon />
						<AlertTitle>Database Connected</AlertTitle>
						<AlertDescription>All systems operational. Last sync: 2 minutes ago.</AlertDescription>
					</Alert>
				</FramePanel>
				<FramePanel className="overflow-hidden p-0!">
					<Alert variant="warning" className="border-0 bg-transparent shadow-none">
						<GlobeIcon />
						<AlertTitle>API Latency Warning</AlertTitle>
						<AlertAction>
							<Button size="xs" variant="outline" className="h-7">
								<RefreshCwIcon className="mr-1 size-3" />
								Retry
							</Button>
						</AlertAction>
						<AlertDescription>Increased latency detected in US-East regions. Our engineers are investigating.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
