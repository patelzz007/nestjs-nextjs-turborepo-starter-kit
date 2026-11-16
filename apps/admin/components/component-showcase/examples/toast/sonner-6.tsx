"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

function showArchivedToast(): void {
	const id = toast.add({
		title: "Message archived",
		description: "The conversation has been moved to archive.",
		actionProps: {
			children: "Undo",
			onClick: (): void => {
				toast.close(id);
				toastMessage.success({ title: "Action undone" });
			},
		},
	});
}

export function Sonner6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showArchivedToast} variant="outline" className="w-fit">
				Toast with Action
			</Button>
		</div>
	);
}
