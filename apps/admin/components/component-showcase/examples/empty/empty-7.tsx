import * as React from "react";
import { InboxIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty7Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Empty className="py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<InboxIcon />
					</EmptyMedia>
					<EmptyTitle>Inbox zero</EmptyTitle>
					<EmptyDescription>You&apos;re all caught up. No new messages.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
