"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// A pull-request notice: the description shows the approving reviewers as an
// avatar stack, and "Merge" is the action.

interface Reviewer {
	readonly name: string;
	readonly initials: string;
}

const REVIEWERS: readonly Reviewer[] = [
	{ name: "Alex Johnson", initials: "AJ" },
	{ name: "Sarah Chen", initials: "SC" },
	{ name: "David Kim", initials: "DK" },
];

const PULL_REQUEST_DESCRIPTION = (
	<>
		<span className="block">
			All reviewers approved. Ready to merge into <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">main</code>
		</span>
		<span className="mt-2 flex items-center justify-between gap-2">
			<span className="flex -space-x-2">
				{REVIEWERS.map((reviewer: Reviewer): React.JSX.Element => (
					<Avatar key={reviewer.name} className="size-6 border-2 border-background">
						<AvatarFallback className="text-xs">{reviewer.initials}</AvatarFallback>
					</Avatar>
				))}
			</span>
			<span className="text-xs">2m ago</span>
		</span>
	</>
);

function showPullRequestToast(): void {
	const id = toast.add({
		title: "Pull Request #284",
		description: PULL_REQUEST_DESCRIPTION,
		actionProps: {
			children: "Merge",
			onClick: (): void => {
				toast.close(id);
				toastMessage.success({ title: "Merged successfully" });
			},
		},
	});
}

export function Sonner17Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showPullRequestToast} variant="outline" className="w-fit">
				PR Merge Toast
			</Button>
		</div>
	);
}
