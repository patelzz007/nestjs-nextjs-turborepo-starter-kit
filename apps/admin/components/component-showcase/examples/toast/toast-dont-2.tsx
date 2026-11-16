"use client";

import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";

function showToast(): void {
	const id = toast.add({
		title: "Project deleted",
		actionProps: {
			children: "Undo",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function ToastDont2Example(): React.JSX.Element {
	return (
		<Button variant="outline" onClick={showToast}>
			Delete project
		</Button>
	);
}
