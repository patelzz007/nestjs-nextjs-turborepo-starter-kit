import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

export function Alert12Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame>
				<FramePanel className="overflow-hidden p-0!">
					<Alert className="border-0 shadow-none">
						<InfoIcon className="text-destructive" />
						<AlertTitle>System Update</AlertTitle>
						<AlertDescription>A new system update is available. Please restart your application to apply the changes.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
