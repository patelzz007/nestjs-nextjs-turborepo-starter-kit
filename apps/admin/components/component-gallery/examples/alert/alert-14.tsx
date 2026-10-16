import * as React from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";

export function Alert14Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame>
				<FramePanel className="overflow-hidden p-0!">
					<Alert className="border-0 shadow-none">
						<ShieldCheckIcon className="text-success" />
						<AlertTitle>Security Update</AlertTitle>
						<AlertAction>
							<Button variant="outline" size="xs">
								Dismiss
							</Button>
							<Button size="xs">Update</Button>
						</AlertAction>
						<AlertDescription>Update your password and enable 2FA to improve your account security.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
