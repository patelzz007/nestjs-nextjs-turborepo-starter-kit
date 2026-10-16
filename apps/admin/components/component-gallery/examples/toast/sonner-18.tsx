"use client";

import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// Every toast has a close (x) button at its top-right corner; with auto-dismiss
// off (`timeout: 0`) it is the only way the toast goes away.

/** A `timeout` of 0 disables auto-dismiss. */
const UNTIL_CLOSED_TIMEOUT_MS = 0;

function showUploadedToast(): void {
	toastMessage.success({
		title: "File uploaded successfully",
		description: "report-2025.pdf has been saved to your documents.",
		timeout: UNTIL_CLOSED_TIMEOUT_MS,
	});
}

export function Sonner18Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showUploadedToast} variant="outline" className="w-fit">
				Toast with Close Button
			</Button>
		</div>
	);
}
