import * as React from "react";
import { BellOffIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Empty className="bg-muted py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BellOffIcon />
					</EmptyMedia>
					<EmptyTitle>No notifications</EmptyTitle>
					<EmptyDescription>When you get notifications, they&apos;ll show up here.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
