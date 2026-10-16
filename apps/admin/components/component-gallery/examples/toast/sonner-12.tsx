"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// An info toast with a primary action; "Later" is the toast's close button.

function showUpdateToast(): void {
	const id = toastMessage.info({
		title: "New Version Available",
		description: "v2.4.0 includes performance improvements and bug fixes.",
		actionProps: {
			children: "Update Now",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showUpdateToast} variant="outline" className="w-fit">
				Update Available Toast
			</Button>
		</div>
	);
}
