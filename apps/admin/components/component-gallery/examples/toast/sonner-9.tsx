"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";
import type * as React from "react";

// A message notification: the sender's avatar replaces the type icon (`data.icon`),
// the description carries the message and its age, and Reply is the action.

const SENDER_AVATAR = (
	<Avatar className="size-9">
		<AvatarFallback>AJ</AvatarFallback>
	</Avatar>
);

const MESSAGE_DESCRIPTION = (
	<>
		<span className="block">Hey! I&apos;ve finished the design review. Let me know when you&apos;re free to discuss.</span>
		<span className="mt-1 block text-xs">2m ago</span>
	</>
);

function showMessageToast(): void {
	const id = toast.add({
		title: "Alex Johnson",
		description: MESSAGE_DESCRIPTION,
		data: { icon: SENDER_AVATAR },
		actionProps: {
			children: "Reply",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showMessageToast} variant="outline" className="w-fit">
				User Message Toast
			</Button>
		</div>
	);
}
