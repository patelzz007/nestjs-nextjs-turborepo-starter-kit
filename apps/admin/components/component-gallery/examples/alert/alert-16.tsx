import * as React from "react";
import { CreditCardIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";

export function Alert16Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Frame>
				<FramePanel className="overflow-hidden p-0!">
					<Alert variant="destructive" className="border-0 bg-destructive/5 shadow-none">
						<CreditCardIcon />
						<AlertTitle>Subscription Expiring</AlertTitle>
						<AlertAction>
							<Button size="xs" variant="destructive">
								Renew Now
							</Button>
						</AlertAction>
						<AlertDescription>Your annual subscription will expire in 3 days. Renew now to avoid service interruption and data loss.</AlertDescription>
					</Alert>
				</FramePanel>
			</Frame>
		</div>
	);
}
