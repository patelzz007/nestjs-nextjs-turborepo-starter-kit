import * as React from "react";
import { FolderIcon, PlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderIcon />
					</EmptyMedia>
					<EmptyTitle>Nothing to see here</EmptyTitle>
					<EmptyDescription>
						No posts have been created yet. Get started by <a href="#component-empty">creating your first post</a>.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant="outline">
						<PlusIcon data-icon="inline-start" />
						New Post
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
