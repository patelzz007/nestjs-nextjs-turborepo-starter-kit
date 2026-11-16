import Link from "next/link";
import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty>
				<EmptyHeader>
					<EmptyTitle>No projects yet</EmptyTitle>
					<EmptyDescription>You haven&apos;t created any projects yet. Get started by creating your first project.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex gap-2">
						<Button render={<Link href="#component-empty" />} nativeButton={false}>
							Create project
						</Button>
						<Button variant="outline">Import project</Button>
					</div>
					<Button variant="link" render={<Link href="#component-empty" />} className="text-muted-foreground" nativeButton={false}>
						Learn more <ArrowUpRightIcon />
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
