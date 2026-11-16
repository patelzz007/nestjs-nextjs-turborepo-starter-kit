"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// An info toast with the inviter's avatar as its icon; "Accept" is the action
// and closing the toast declines.

const INVITER_AVATAR = (
	<Avatar className="size-9">
		<AvatarFallback>SC</AvatarFallback>
	</Avatar>
);

const INVITE_DESCRIPTION = (
	<>
		<span className="block">Invited you to collaborate on &quot;Design System v2&quot;</span>
		<span className="mt-1 block text-xs">Just now</span>
	</>
);

function showInviteToast(): void {
	const id = toastMessage.info({
		title: "Sarah Chen",
		description: INVITE_DESCRIPTION,
		data: { icon: INVITER_AVATAR },
		actionProps: {
			children: "Accept",
			onClick: (): void => {
				toast.close(id);
				toastMessage.success({ title: "Invitation accepted" });
			},
		},
	});
}

export function Sonner15Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showInviteToast} variant="outline" className="w-fit">
				Invite Toast
			</Button>
		</div>
	);
}
