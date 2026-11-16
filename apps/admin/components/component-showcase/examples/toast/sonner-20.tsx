"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import { LinkIcon } from "lucide-react";
import type * as React from "react";

// An integration notice: a neutral link icon, the workspace and sync status in
// the description, and "Configure" as the action.

const INTEGRATION_ICON = <LinkIcon className="size-4" aria-hidden="true" />;

const INTEGRATION_DESCRIPTION = (
	<>
		<span className="block">chat.example.com</span>
		<span className="mt-1 flex items-center justify-between gap-4 text-xs">
			<span className="flex items-center gap-1 text-success">
				<span className="size-1.5 rounded-full bg-success" />
				Active
			</span>
			<span>Syncing 3 channels · Last sync: just now</span>
		</span>
	</>
);

function showIntegrationToast(): void {
	const id = toastMessage.success({
		title: "Integration Connected",
		description: INTEGRATION_DESCRIPTION,
		data: { icon: INTEGRATION_ICON },
		actionProps: {
			children: "Configure",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner20Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showIntegrationToast} variant="outline" className="w-fit">
				Integration Toast
			</Button>
		</div>
	);
}
