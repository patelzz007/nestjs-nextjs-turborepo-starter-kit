import * as React from "react";
import { BarChart3Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty10Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Empty className="border py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BarChart3Icon />
					</EmptyMedia>
					<EmptyTitle>No data yet</EmptyTitle>
					<EmptyDescription>Once your project starts receiving traffic, analytics will appear here.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex gap-2">
						<Button size="sm">Connect Data Source</Button>
						<Button variant="outline" size="sm">
							View Docs
						</Button>
					</div>
				</EmptyContent>
			</Empty>
		</div>
	);
}
