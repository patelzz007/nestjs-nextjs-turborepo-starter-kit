"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

/** The warning stays a little longer than the default, so there is time to react (ms). */
const SESSION_WARNING_TIMEOUT_MS = 10000;

function showSessionWarning(): void {
	const id = toastMessage.warning({
		title: "Session Expiring",
		description: "Your session will expire in 5 minutes due to inactivity.",
		timeout: SESSION_WARNING_TIMEOUT_MS,
		actionProps: {
			children: "Extend Session",
			onClick: (): void => {
				toast.close(id);
				toastMessage.success({ title: "Session extended" });
			},
		},
	});
}

export function Sonner16Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showSessionWarning} variant="outline" className="w-fit">
				Session Warning Toast
			</Button>
		</div>
	);
}
