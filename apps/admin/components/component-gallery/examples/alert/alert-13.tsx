import * as React from "react";
import { AlertTriangleIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";

export function Alert13Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame stacked>
				<FramePanel className="p-0!">
					<Alert variant="success" className="rounded-none border-0 shadow-none">
						<CircleCheckIcon />
						<AlertTitle>Deployment Successful</AlertTitle>
						<AlertDescription>Your application has been successfully deployed to the production environment.</AlertDescription>
					</Alert>
				</FramePanel>
				<FramePanel className="p-0!">
					<Alert variant="warning" className="rounded-none border-0 shadow-none">
						<AlertTriangleIcon className="text-warning" />
						<AlertTitle>Resource Limit Reached</AlertTitle>
						<AlertAction>
							<Button size="xs">Verify</Button>
						</AlertAction>
						<AlertDescription>Your current plan has reached its resource limits. Consider upgrading to a higher tier.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
