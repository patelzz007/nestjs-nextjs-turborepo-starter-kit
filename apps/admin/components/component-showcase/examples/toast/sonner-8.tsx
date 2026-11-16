"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// A toast carries one action button; its close (x) button is the way to cancel.

/** A `timeout` of 0 keeps the confirmation open until the user decides. */
const UNTIL_DECIDED_TIMEOUT_MS = 0;

function showConfirmToast(): void {
	const id = toast.add({
		title: "Confirm deletion",
		description: "This item will be permanently deleted. Close this notice to cancel.",
		timeout: UNTIL_DECIDED_TIMEOUT_MS,
		actionProps: {
			children: "Delete",
			onClick: (): void => {
				toast.close(id);
				toastMessage.success({ title: "Item deleted" });
			},
		},
	});
}

export function Sonner8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showConfirmToast} variant="outline" className="w-fit">
				Confirm Action
			</Button>
		</div>
	);
}
