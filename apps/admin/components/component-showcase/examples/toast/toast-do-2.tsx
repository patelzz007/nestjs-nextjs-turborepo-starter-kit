"use client";

import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";

function showToast(): void {
	const id = toast.add({
		title: "Message archived",
		actionProps: {
			children: "Undo",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function ToastDo2Example(): React.JSX.Element {
	return (
		<Button variant="outline" onClick={showToast}>
			Archive message
		</Button>
	);
}
