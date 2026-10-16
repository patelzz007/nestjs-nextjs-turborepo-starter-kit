import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty className="min-h-[300px] w-full max-w-md">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Spinner className="size-4" />
					</EmptyMedia>
					<EmptyTitle>Loading projects</EmptyTitle>
					<EmptyDescription>Please wait while we fetch your project data. This should only take a moment.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant="outline" disabled>
						Cancel
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
