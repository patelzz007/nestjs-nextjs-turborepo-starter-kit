import * as React from "react";
import { IconStack } from "@workspace/ui/components/icon-stack";
import { InboxIcon } from "lucide-react";

export function IconStackDo1Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center gap-3 text-center">
			<IconStack aria-hidden="true">
				<InboxIcon className="size-4" />
			</IconStack>
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">Your inbox is empty</p>
				<p className="text-sm text-muted-foreground">New messages from your team show up here.</p>
			</div>
		</div>
	);
}
